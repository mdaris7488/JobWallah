import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { adminApi, downloadReceipt } from '../../api';
import { getErrorMessage } from '../../api/http';
import { useFetch } from '../../utils/useFetch';
import { showToast } from '../../store/uiSlice';
import { Loading, ErrorBox, Empty, Pagination, Select } from '../../components/common';
import { formatDate, formatNumber } from '../../utils/format';

const TONE = { paid: 'badge-active', created: 'badge-new', failed: 'badge-closing-soon', refunded: 'badge-expired' };

export default function AdminPayments() {
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [q, setQ] = useState(get('q'));
  const list = useFetch(() => adminApi.payments({ page, limit: 15, status: get('status'), q: get('q') }), [params.toString()]);

  const setParam = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const summary = list.summary;

  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>Payments</h1><p className="muted">Every order started on the site. Refunds are issued from the Razorpay dashboard and sync back automatically.</p></div></div>

      <div className="stats">
        <div className="stat"><strong>₹{formatNumber(summary?.revenue)}</strong><span>Total revenue</span></div>
        <div className="stat"><strong>₹{formatNumber(summary?.last30)}</strong><span>Last 30 days</span></div>
        <div className="stat"><strong>{formatNumber(summary?.paidCount)}</strong><span>Paid orders</span></div>
      </div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }}>
        <input type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <Select value={get('status')} onChange={(v) => setParam('status', v)} placeholder="All statuses" aria-label="Status"
          options={['paid', 'created', 'failed', 'refunded'].map((s) => ({ value: s, label: s }))} />
        <button className="btn btn-primary">Search</button>
      </form>

      {list.loading ? <Loading /> : list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : !list.data.length ? <Empty title="No payments found" /> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>Date</th><th>Customer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Payment id</th><th>Receipt</th></tr></thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.id}>
                  <td className="small">{formatDate(p.paidAt || p.createdAt)}</td>
                  <td><strong>{p.user?.name || p.billing?.name}</strong><div className="muted small">{p.user?.email || p.billing?.email}{p.user?.phone ? ` · ${p.user.phone}` : ''}</div></td>
                  <td>{p.planName}{p.exam && <div className="muted small">{p.exam.title}</div>}</td>
                  <td>₹{p.amount}{p.method && <div className="muted small">{p.method.toUpperCase()}</div>}</td>
                  <td><span className={`badge ${TONE[p.status] || ''}`}>{p.status}</span>{p.failedReason && <div className="muted small">{p.failedReason}</div>}</td>
                  <td className="small">{p.providerPaymentId || '-'}<div className="muted">{p.provider}</div></td>
                  <td>{p.invoiceNo ? <button className="btn btn-ghost btn-sm" onClick={() => downloadReceipt(p.id, p.invoiceNo).catch((e) => dispatch(showToast({ type: 'error', message: getErrorMessage(e) })))}>PDF</button> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.meta && <Pagination page={list.meta.page} pages={list.meta.pages} onChange={(p) => setParam('page', p)} />}
    </div>
  );
}
