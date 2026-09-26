import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { paymentsApi, subsApi, downloadReceipt } from '../api';
import { getErrorMessage } from '../api/http';
import { useFetch } from '../utils/useFetch';
import { loadScript } from '../utils/loadScript';
import { showToast } from '../store/uiSlice';
import { Loading, ErrorBox, Select } from '../components/common';
import ExamPicker from '../components/ExamPicker';
import { formatDate } from '../utils/format';

const TRUST = [
  ['🔒', 'Secure payment by Razorpay', 'We never see or store your card / UPI details.'],
  ['📲', 'UPI, cards, netbanking, wallets', 'Pay the way you like.'],
  ['🧾', 'Instant receipt', 'Emailed to you and available in your dashboard.'],
];

/** Payment page:  order summary  +  pay button  ->  Razorpay Checkout  ->  server verifies the signature  ->  plan active. */
export default function Checkout() {
  const { plan: planId } = useParams();
  const [params] = useSearchParams();
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();

  const plans = useFetch(() => subsApi.plans(), []);
  const [exam, setExam] = useState(params.get('exam') || '');
  const [agree, setAgree] = useState(false);
  const [stage, setStage] = useState('form'); // form | paying | verifying | success | failed
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => { document.title = 'Checkout · JobWallah'; }, []);

  if (plans.loading) return <div className="container page"><Loading /></div>;
  if (plans.error) return <div className="container page"><ErrorBox message={plans.error} onRetry={plans.reload} /></div>;

  const plan = plans.data.plans.find((p) => p.id === planId);
  if (!plan) {
    return (
      <div className="container page narrow center">
        <h1>Plan not found</h1>
        <Link className="btn btn-primary" to="/pricing">See all plans</Link>
      </div>
    );
  }
  const demo = plans.data.paymentMode === 'demo';
  const busy = stage === 'paying' || stage === 'verifying';

  const finish = (data) => {
    setDone(data);
    setStage('success');
    dispatch(showToast({ type: 'success', message: `${plan.name} is now active.` }));
  };

  const verify = async (order, response) => {
    setStage('verifying');
    try {
      const { data } = await paymentsApi.verify({ paymentId: order.paymentId, ...response });
      finish(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setStage('failed');
    }
  };

  const openCheckout = async (order) => {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.providerOrderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: 'JobWallah',
      description: order.plan.name,
      prefill: order.prefill,
      theme: { color: '#e8710a' },
      modal: { confirm_close: true, ondismiss: () => setStage((s) => (s === 'paying' ? 'form' : s)) },
      handler: (response) => verify(order, response),
    });
    rzp.on('payment.failed', (r) => {
      setError(r?.error?.description || 'The payment failed. You have not been charged. Please try again.');
      setStage('failed');
    });
    rzp.open();
  };

  const pay = async () => {
    setError('');
    if (plan.id === 'single_exam' && !exam) return setError('Choose the exam you want to track.');
    if (!agree) return setError('Please accept the terms to continue.');
    setStage('paying');
    try {
      const { data } = await paymentsApi.createOrder({ plan: plan.id, jobId: plan.id === 'single_exam' ? exam : undefined });
      const order = data.data;
      if (order.mode === 'demo') {
        const res = await paymentsApi.demoConfirm({ paymentId: order.paymentId });
        finish(res.data.data);
      } else {
        await openCheckout(order);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setStage('form');
    }
    return undefined;
  };

  if (stage === 'success' && done) {
    return (
      <div className="container page narrow">
        <div className="panel pay-done">
          <div className="success-box">
            <div className="success-check" aria-hidden="true">✓</div>
            <h1>Payment successful</h1>
            <p className="muted">
              <strong>{plan.name}</strong> is active until <strong>{formatDate(done.endsAt)}</strong>.
              {done.payment.invoiceNo && <> Receipt no. {done.payment.invoiceNo}.</>}
            </p>
            <div className="row-actions">
              <Link className="btn btn-accent" to="/tools">Use the Pro tools</Link>
              <Link className="btn btn-primary" to="/dashboard?tab=subscription">My subscription</Link>
              <button className="btn btn-ghost" onClick={() => downloadReceipt(done.payment.id, done.payment.invoiceNo).catch((e) => dispatch(showToast({ type: 'error', message: getErrorMessage(e) })))}>Download receipt</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-head"><div><h1>Checkout</h1><p className="muted">You are one step away from {plan.name}.</p></div></div>
      {demo && <p className="notice">Demo payment mode: no real money is charged. The site admin must switch to Razorpay before going live.</p>}

      <div className="checkout">
        <section className="panel summary" aria-label="Order summary">
          <h2 className="panel-title">Order summary</h2>
          <div className="summary-plan">
            <div><strong>{plan.name}</strong><div className="muted small">Valid for {plan.days} days{plan.period === 'one-time' ? '' : ` · ${plan.period}ly`}</div></div>
            <span className="summary-price">₹{plan.price}</span>
          </div>
          <ul className="summary-features">{plan.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <div className="summary-row"><span>Subtotal</span><span>₹{plan.price}</span></div>
          <div className="summary-row muted"><span>Taxes</span><span>Included</span></div>
          <div className="summary-row summary-total"><span>Total to pay</span><span>₹{plan.price}</span></div>
        </section>

        <section className="panel pay-card" aria-label="Payment">
          <h2 className="panel-title">Your details</h2>
          <dl className="payer">
            <div><dt>Name</dt><dd>{user.name}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Mobile</dt><dd>{user.phone || '-'}</dd></div>
          </dl>
          <p className="muted small">Receipt goes to this email. <Link to="/dashboard?tab=profile">Change details</Link></p>

          {plan.id === 'single_exam' && (
            <label className="field">
              <span className="field-label">Exam to track</span>
              <ExamPicker value={exam} onChange={setExam} />
            </label>
          )}

          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link to="/legal/terms" target="_blank">Terms</Link> and the <Link to="/legal/refund" target="_blank">Refund policy</Link>.</span>
          </label>

          {error && <div className="form-error" role="alert">{error}{stage === 'failed' && <> If money was deducted, your plan activates automatically within a few minutes - check <Link to="/dashboard?tab=subscription">My subscription</Link>.</>}</div>}

          <button className="btn btn-accent btn-block btn-lg pay-btn" onClick={pay} disabled={busy}>
            {stage === 'verifying' ? 'Confirming your payment…' : stage === 'paying' ? 'Opening secure payment…' : demo ? `Complete demo payment · ₹${plan.price}` : `Pay ₹${plan.price} securely`}
          </button>

          <ul className="trust-list">
            {TRUST.map(([icon, title, sub]) => (
              <li key={title}><span aria-hidden="true">{icon}</span><div><strong>{title}</strong><div className="muted small">{sub}</div></div></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
