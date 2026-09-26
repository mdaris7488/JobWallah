/**
 * Offline self-test of the payment building blocks (no database, no real Razorpay account needed):
 *   npm run test:payments
 * Starts a tiny fake Razorpay server and checks: order creation request, payment lookup/capture, gateway errors,
 * checkout + webhook signature verification, the receipt PDF and the receipt email.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { PDFDocument } from 'pdf-lib';

let failed = 0;
const ok = (c, m) => { console.log(`${c ? '  ✅' : '  ❌'} ${m}`); if (!c) failed += 1; };

// ---- fake Razorpay -------------------------------------------------------
const seen = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'POST' && req.url === '/v1/orders') {
      const b = JSON.parse(body);
      return b.amount < 100 ? send(400, { error: { description: 'Amount must be at least INR 1.00' } }) : send(200, { id: 'order_TEST123', amount: b.amount, currency: b.currency, receipt: b.receipt, status: 'created' });
    }
    if (req.method === 'GET' && req.url === '/v1/payments/pay_TEST1') return send(200, { id: 'pay_TEST1', order_id: 'order_TEST123', amount: 9900, currency: 'INR', status: 'authorized', method: 'upi' });
    if (req.method === 'POST' && req.url === '/v1/payments/pay_TEST1/capture') return send(200, { id: 'pay_TEST1', order_id: 'order_TEST123', amount: 9900, currency: 'INR', status: 'captured', method: 'upi' });
    return send(404, { error: { description: 'not found' } });
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

Object.assign(process.env, {
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost/x',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'x'.repeat(40),
  PAYMENT_MODE: 'razorpay',
  RAZORPAY_KEY_ID: 'rzp_test_abc123',
  RAZORPAY_KEY_SECRET: 'test_key_secret_value',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_test_value',
  RAZORPAY_API_BASE: `http://127.0.0.1:${server.address().port}`,
});
const rz = await import('../services/razorpay.js');
const { buildReceiptPdf } = await import('../services/invoice.js');
const { paymentReceiptEmail } = await import('../services/mailer.js');

console.log('▶ Razorpay API client');
ok(rz.rupeesToPaise(99) === 9900 && rz.rupeesToPaise(29.5) === 2950, 'rupees -> paise');
const order = await rz.createRazorpayOrder({ amountPaise: 9900, receipt: 'rs_1234567890', notes: { plan: 'monthly_pro' } });
const first = seen[0];
ok(order.id === 'order_TEST123', 'order created');
ok(first.body.amount === 9900 && first.body.currency === 'INR', 'amount is sent in paise, currency INR');
ok(first.auth === `Basic ${Buffer.from('rzp_test_abc123:test_key_secret_value').toString('base64')}`, 'HTTP Basic auth uses key id + secret');
let gw = null;
try { await rz.createRazorpayOrder({ amountPaise: 50, receipt: 'r' }); } catch (e) { gw = e; }
ok(gw && gw.statusCode === 502 && gw.appCode === 'GATEWAY_ERROR' && !/INR 1\.00/.test(gw.message), 'gateway error becomes a safe 502 (no internal details leaked)');
const rp = await rz.fetchRazorpayPayment('pay_TEST1');
ok(rp.status === 'authorized', 'payment fetched');
const cap = await rz.captureRazorpayPayment('pay_TEST1', 9900);
ok(cap.status === 'captured' && seen.at(-1).body.amount === 9900, 'authorized payment can be captured');

console.log('\n▶ Signatures');
const sign = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const good = sign('test_key_secret_value', 'order_TEST123|pay_TEST1');
ok(rz.verifyCheckoutSignature({ orderId: 'order_TEST123', paymentId: 'pay_TEST1', signature: good }), 'valid checkout signature accepted');
ok(!rz.verifyCheckoutSignature({ orderId: 'order_TEST123', paymentId: 'pay_TEST2', signature: good }), 'signature for another payment id rejected');
ok(!rz.verifyCheckoutSignature({ orderId: 'order_OTHER', paymentId: 'pay_TEST1', signature: good }), 'signature for another order rejected');
ok(!rz.verifyCheckoutSignature({ orderId: 'order_TEST123', paymentId: 'pay_TEST1', signature: 'a'.repeat(64) }), 'forged signature rejected');
ok(!rz.verifyCheckoutSignature({ orderId: 'order_TEST123', paymentId: 'pay_TEST1', signature: 'nothex' }), 'garbage signature rejected without throwing');
const raw = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_TEST1' } } } }));
ok(rz.verifyWebhookSignature(raw, sign('whsec_test_value', raw)), 'valid webhook signature accepted');
ok(!rz.verifyWebhookSignature(Buffer.from(`${raw}x`), sign('whsec_test_value', raw)), 'tampered webhook body rejected');
ok(!rz.verifyWebhookSignature(raw, sign('wrong-secret', raw)), 'webhook signed with another secret rejected');
ok(!rz.verifyWebhookSignature(JSON.parse(raw), sign('whsec_test_value', raw)), 'parsed (non-raw) body is refused - raw bytes are required');

console.log('\n▶ Receipt PDF');
const pdf = await buildReceiptPdf({
  receiptNo: 'RS-2026-000123', paidAt: new Date(), status: 'paid', planName: 'Monthly Pro', validity: 'Valid for 30 days', amount: 99,
  paymentId: 'pay_TEST1', method: 'upi', provider: 'razorpay', billing: { name: 'रवि Kumar <script>', email: 'ravi@example.com', phone: '+919876543210' },
});
const doc = await PDFDocument.load(pdf);
ok(pdf.subarray(0, 5).toString() === '%PDF-' && doc.getPageCount() === 1, `valid one-page PDF (${pdf.length} bytes), Hindi/unsupported characters do not crash it`);
if (process.env.SAVE_RECEIPT) (await import('node:fs')).writeFileSync(process.env.SAVE_RECEIPT, pdf);

console.log('\n▶ Receipt email');
const mail = paymentReceiptEmail({ name: '<b>Ravi</b> Kumar', planName: 'Monthly Pro', amount: 99, receiptNo: 'RS-2026-000123', endsAt: new Date(Date.now() + 30 * 864e5) });
ok(mail.text.includes('RS-2026-000123') && mail.subject.includes('Monthly Pro'), 'mentions plan and receipt number');
ok(!mail.html.includes('<b>Ravi') && mail.html.includes('&lt;b&gt;Ravi'), 'name is HTML-escaped');

server.close();
console.log(failed ? `\n❌ ${failed} failed` : '\n✅ All payment checks passed');
process.exit(failed ? 1 : 0);
