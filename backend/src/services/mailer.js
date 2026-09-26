// import { env, isProd } from '../config/env.js';

// let transporterPromise;
// async function getTransporter() {
//   if (!env.SMTP_HOST) return null;
//   if (!transporterPromise) {
//     transporterPromise = import('nodemailer')
//       .then((m) => (m.default || m).createTransport({
//         host: env.SMTP_HOST,
//         port: env.SMTP_PORT,
//         secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : env.SMTP_PORT === 465,
//         auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
//         connectionTimeout: 10_000,
//         socketTimeout: 15_000,
//       }))
//       .catch((err) => { console.error('nodemailer could not be loaded. Run "npm install".', err.message); return null; });
//   }
//   return transporterPromise;
// }

// /**
//  * Sends an email. Without SMTP settings in DEVELOPMENT ONLY, the message is printed to the terminal
//  * instead so the whole reset flow can be tested without an email account.
//  * In production, a missing SMTP config never prints the message (which could contain a reset code or
//  * receipt details) to logs - it fails loudly instead so the operator notices and fixes the SMTP setup.
//  */
// export async function sendMail({ to, subject, text, html }) {
//   const transporter = await getTransporter();
//   if (!transporter) {
//     if (isProd) {
//       // Never dump email bodies (they can contain OTP codes / receipts) into production logs.
//       throw new Error(`Email not sent to ${to}: SMTP is not configured on this server.`);
//     }
//     console.log(`\n📧 [DEV MAIL - SMTP not configured]\n   to:      ${to}\n   subject: ${subject}\n   ${text.split('\n').join('\n   ')}\n`);
//     return { dev: true };
//   }
//   await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
//   return { sent: true };
// }

// const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// const shell = (title, body) => `<!doctype html><html><body style="margin:0;background:#f2f5f9;font-family:Segoe UI,Arial,sans-serif;color:#14213a">
// <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
// <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d9e1ec">
// <tr><td style="background:#0e2240;padding:20px 28px"><span style="display:inline-block;background:#f59e0b;color:#0e2240;font-weight:700;border-radius:6px;padding:4px 8px;margin-right:8px">JW</span><span style="color:#ffffff;font-size:18px;font-weight:600">JobWallah</span></td></tr>
// <tr><td style="padding:28px"><h2 style="margin:0 0 12px;font-size:20px;color:#0e2240">${esc(title)}</h2>${body}</td></tr>
// <tr><td style="padding:16px 28px;background:#f8fafc;color:#5b6980;font-size:12px">JobWallah is an independent employment information platform. If you did not request this email you can safely ignore it.</td></tr>
// </table></td></tr></table></body></html>`;

// export function passwordResetEmail({ name, code, minutes }) {
//   const first = String(name || 'there').split(' ')[0];
//   const subject = `${code} is your JobWallah password reset code`;
//   const text = `Hi ${first},\n\nYour password reset code is: ${code}\nIt expires in ${minutes} minutes and works only once.\n\nIf you did not ask for this, ignore this email - your password will not change. Never share this code with anyone.`;
//   const html = shell('Reset your password', `
//     <p style="margin:0 0 16px">Hi ${esc(first)}, use this code to reset your password:</p>
//     <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0e2240;background:#fff4e5;border:1px dashed #f59e0b;border-radius:12px;padding:14px 0;text-align:center">${esc(code)}</div>
//     <p style="margin:16px 0 0;color:#5b6980;font-size:14px">This code expires in <strong>${minutes} minutes</strong> and works only once. Never share it - we will never ask for it.</p>`);
//   return { subject, text, html };
// }

// export function paymentReceiptEmail({ name, planName, amount, receiptNo, endsAt }) {
//   const first = String(name || 'there').split(' ')[0];
//   const until = new Date(endsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
//   const subject = `Payment received - ${planName} is active`;
//   const text = `Hi ${first},\n\nThank you! We received Rs. ${amount} for ${planName}.\nReceipt no: ${receiptNo}\nActive until: ${until}\n\nYou can download the receipt anytime from Dashboard > Subscription.`;
//   const html = shell('Payment received', `
//     <p style="margin:0 0 12px">Hi ${esc(first)}, thank you! Your <strong>${esc(planName)}</strong> is now active.</p>
//     <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border-radius:10px;font-size:14px">
//       <tr><td style="color:#5b6980">Amount paid</td><td align="right"><strong>Rs. ${esc(amount)}</strong></td></tr>
//       <tr><td style="color:#5b6980">Receipt no.</td><td align="right">${esc(receiptNo)}</td></tr>
//       <tr><td style="color:#5b6980">Active until</td><td align="right">${esc(until)}</td></tr>
//     </table>
//     <p style="margin:16px 0 0;color:#5b6980;font-size:14px">Download your receipt anytime from <strong>Dashboard &rarr; Subscription</strong>.</p>`);
//   return { subject, text, html };
// }

import { env, isProd } from '../config/env.js';

let transporterPromise;

async function getTransporter() {
  if (!env.SMTP_HOST) return null;

  if (!transporterPromise) {
    // Port number convert karke secure option dynamic set kar rahe hain
    const port = Number(env.SMTP_PORT) || 587;
    const isSecure = env.SMTP_SECURE === 'true' || env.SMTP_SECURE === true || port === 465;

    transporterPromise = import('nodemailer')
      .then((m) =>
        (m.default || m).createTransport({
          host: env.SMTP_HOST,
          port: port,
          secure: isSecure, // Port 587 -> false, Port 465 -> true
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          connectionTimeout: 15_000,
          socketTimeout: 20_000,
          tls: {
            rejectUnauthorized: false, // TLS handshake issues avoid karne ke liye
          },
        })
      )
      .catch((err) => {
        console.error('Nodemailer loading error:', err.message);
        return null;
      });
  }
  return transporterPromise;
}

/**
 * Sends an email. Without SMTP settings in DEVELOPMENT ONLY, the message is printed to the terminal
 * instead so the whole reset flow can be tested without an email account.
 * In production, a missing SMTP config never prints the message to logs.
 */
export async function sendMail({ to, subject, text, html }) {
  const transporter = await getTransporter();

  if (!transporter) {
    if (isProd) {
      throw new Error(`Email not sent to ${to}: SMTP is not configured on this server.`);
    }
    console.log(
      `\n📧 [DEV MAIL - SMTP not configured]\n   to:      ${to}\n   subject: ${subject}\n   ${text ? text.split('\n').join('\n   ') : ''}\n`
    );
    return { dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log(`✅ Mail sent successfully to ${to} | ID: ${info.messageId}`);
    return { sent: true };
  } catch (error) {
    console.error(`❌ SMTP Sending Failed for ${to}:`, error.message);
    throw error;
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const shell = (title, body) => `<!doctype html><html><body style="margin:0;background:#f2f5f9;font-family:Segoe UI,Arial,sans-serif;color:#14213a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d9e1ec">
<tr><td style="background:#0e2240;padding:20px 28px"><span style="display:inline-block;background:#f59e0b;color:#0e2240;font-weight:700;border-radius:6px;padding:4px 8px;margin-right:8px">JW</span><span style="color:#ffffff;font-size:18px;font-weight:600">JobWallah</span></td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 12px;font-size:20px;color:#0e2240">${esc(title)}</h2>${body}</td></tr>
<tr><td style="padding:16px 28px;background:#f8fafc;color:#5b6980;font-size:12px">JobWallah is an independent employment information platform. If you did not request this email you can safely ignore it.</td></tr>
</table></td></tr></table></body></html>`;

export function passwordResetEmail({ name, code, minutes }) {
  const first = String(name || 'there').split(' ')[0];
  const subject = `${code} is your JobWallah password reset code`;
  const text = `Hi ${first},\n\nYour password reset code is: ${code}\nIt expires in ${minutes} minutes and works only once.\n\nIf you did not ask for this, ignore this email - your password will not change. Never share this code with anyone.`;
  const html = shell(
    'Reset your password',
    `
    <p style="margin:0 0 16px">Hi ${esc(first)}, use this code to reset your password:</p>
    <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#0e2240;background:#fff4e5;border:1px dashed #f59e0b;border-radius:12px;padding:14px 0;text-align:center">${esc(code)}</div>
    <p style="margin:16px 0 0;color:#5b6980;font-size:14px">This code expires in <strong>${minutes} minutes</strong> and works only once. Never share it - we will never ask for it.</p>`
  );
  return { subject, text, html };
}

export function paymentReceiptEmail({ name, planName, amount, receiptNo, endsAt }) {
  const first = String(name || 'there').split(' ')[0];
  const until = new Date(endsAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const subject = `Payment received - ${planName} is active`;
  const text = `Hi ${first},\n\nThank you! We received Rs. ${amount} for ${planName}.\nReceipt no: ${receiptNo}\nActive until: ${until}\n\nYou can download the receipt anytime from Dashboard > Subscription.`;
  const html = shell(
    'Payment received',
    `
    <p style="margin:0 0 12px">Hi ${esc(first)}, thank you! Your <strong>${esc(planName)}</strong> is now active.</p>
    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="background:#f8fafc;border-radius:10px;font-size:14px">
      <tr><td style="color:#5b6980">Amount paid</td><td align="right"><strong>Rs. ${esc(amount)}</strong></td></tr>
      <tr><td style="color:#5b6980">Receipt no.</td><td align="right">${esc(receiptNo)}</td></tr>
      <tr><td style="color:#5b6980">Active until</td><td align="right">${esc(until)}</td></tr>
    </table>
    <p style="margin:16px 0 0;color:#5b6980;font-size:14px">Download your receipt anytime from <strong>Dashboard &rarr; Subscription</strong>.</p>`
  );
  return { subject, text, html };
}