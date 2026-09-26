import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { subsApi } from '../api';
import { useFetch } from '../utils/useFetch';
import { Loading, ErrorBox } from '../components/common';

const FLOW = ['Official Update', 'JobWallah Verification', 'WhatsApp Alert', 'Voice Call Alert', 'Direct Link'];
const COMPARE = [
  ['Browse job listings', '✓', '✓', '✓'],
  ['Exam tracking', 'Limited', 'Unlimited', 'Unlimited'],
  ['Admit card & result alerts', '—', '✓', '✓'],
  ['Voice call alerts', '—', '✓', '✓'],
  ['State exam tracking', '—', '—', '✓'],
  ['Ad-free experience', '—', '✓', '✓'],
  ['Free tools (image, PDF, video)', '✓', '✓', '✓'],
  ['Daily tool uses', '15', '200', '500'],
  ['Batch image jobs (ZIP)', '—', '✓', '✓'],
  ['PDF merge & page extract', '—', '✓', '✓'],
  ['Exam photo & signature tool', '—', '—', '✓'],
];

export default function Pricing() {
  const user = useSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const plans = useFetch(() => subsApi.plans(), []);

  if (plans.loading) return <div className="container page"><Loading /></div>;
  if (plans.error) return <div className="container page"><ErrorBox message={plans.error} onRetry={plans.reload} /></div>;

  const choose = (plan) => {
    const to = `/checkout/${plan.id}`;
    if (!user) navigate('/login', { state: { from: { pathname: to } } });
    else navigate(to);
  };

  return (
    <div className="container page">
      <div className="page-head center-col">
        <h1>JobWallah Pro</h1>
        <p className="muted">Never miss an important exam update — tracked automatically, sent straight to you.</p>
      </div>

      <ol className="flow" aria-label="How alerts work">
        {FLOW.map((step, i) => (<li key={step}><span className="flow-n">{i + 1}</span>{step}</li>))}
      </ol>

      {plans.data.paymentMode === 'demo' && (
        <p className="notice">Demo payment mode: plans activate instantly and no money is charged.</p>
      )}

      <div className="plans">
        {plans.data.plans.map((p) => (
          <section key={p.id} className={`plan ${p.popular ? 'plan-pop' : ''}`}>
            {p.popular && <span className="plan-flag">Most Popular</span>}
            <h2>{p.name}</h2>
            <p className="plan-price">₹{p.price}<span>{p.period === 'one-time' ? '' : `/${p.period}`}</span></p>
            <ul>{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            <button className={`btn btn-block ${p.popular ? 'btn-accent' : 'btn-ghost'}`} onClick={() => choose(p)}>
              Choose plan
            </button>
          </section>
        ))}
      </div>

      <p className="pay-trust">🔒 Secure payments by Razorpay · UPI, cards, netbanking &amp; wallets · Prices include all taxes</p>

      <div className="table-wrap">
        <table className="grid compare">
          <thead><tr><th>Feature</th><th>Free</th><th>Monthly Pro</th><th>Annual Pass</th></tr></thead>
          <tbody>{COMPARE.map((r) => (<tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
