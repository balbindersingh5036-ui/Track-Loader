import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, CalendarDays, CheckCircle2, CircleDollarSign, Clock3,
  CreditCard, ExternalLink, FilterX, RefreshCw, Search, X, XCircle
} from 'lucide-react';
import paymentService from '../../services/paymentService';
import PaymentRefundDialog from './PaymentRefundDialog';
import PaymentStatusBadge from './PaymentStatusBadge';
import { formatMoney, formatPaymentDate, paymentDate, titleCase } from './paymentDisplay';
import './paymentDashboard.css';

const emptySummary = null;
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function SummaryCard({ label, value, note, icon: Icon, tone, active, onClick, amount = false }) {
  return (
    <button
      type="button"
      className={`payment-summary-card ${tone} ${active ? 'is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="payment-summary-icon"><Icon size={19} /></span>
      <span className="payment-summary-label">{label}</span>
      <strong>{value === null || value === undefined ? '—' : amount ? formatMoney(value) : Number(value).toLocaleString('en-IN')}</strong>
      <span className="payment-summary-note">{note}</span>
    </button>
  );
}

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [facets, setFacets] = useState({ methods: [], providers: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '', method: '', provider: '', from: '', to: '', sortBy: 'date', sortOrder: 'desc' });
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('success');
  const hasFilters = useMemo(() => Boolean(appliedSearch || filters.status || filters.method || filters.provider || filters.from || filters.to), [appliedSearch, filters]);

  const loadPayments = useCallback(async (requestedPage = page) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: requestedPage,
        limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };
      if (appliedSearch) params.search = appliedSearch;
      if (filters.status) params.status = filters.status;
      if (filters.method) params.method = filters.method;
      if (filters.provider) params.provider = filters.provider;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const response = await paymentService.getPayments(params);
      const data = response.data?.data;
      if (!Array.isArray(data?.payments) || !data?.pagination) {
        throw new Error('The payments API returned an unexpected response.');
      }
      setPayments(data.payments);
      setSummary(data.summary || null);
      setFacets(data.facets || { methods: [], providers: [] });
      setPagination(data.pagination);
      setPage(data.pagination.page || requestedPage);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load payment records.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, appliedSearch]);

  useEffect(() => { loadPayments(page); }, [loadPayments]);

  const setStatus = (status) => {
    setFilters((current) => ({ ...current, status }));
    setPage(1);
  };
  const setPeriodFilter = (value) => {
    const now = new Date();
    const to = dateKey(now);
    const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (value === '7') fromDate.setDate(fromDate.getDate() - 6);
    if (value === '30') fromDate.setDate(fromDate.getDate() - 29);
    setPeriod(value);
    setFilters((current) => ({ ...current, from: value ? dateKey(fromDate) : '', to: value ? to : '' }));
    setPage(1);
  };
  const updateDate = (key, value) => {
    setPeriod('');
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ status: '', method: '', provider: '', from: '', to: '', sortBy: 'date', sortOrder: 'desc' });
    setSearch('');
    setAppliedSearch('');
    setPeriod('');
    setPage(1);
  };
  const submitSearch = (event) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const submitRefund = async () => {
    if (!refundPayment || refundBusy) return;
    setRefundBusy(true);
    setNotice('');
    try {
      const response = await paymentService.refundPayment(refundPayment.paymentId);
      const result = response.data?.data?.payment;
      if (!response.data?.success || !result?.refundId || !['processed', 'pending', 'failed'].includes(result.refundStatus)) {
        throw new Error(response.data?.message || 'The payment provider did not return a verifiable refund result.');
      }
      if (result.refundStatus === 'processed' && result.status !== 'refunded') {
        throw new Error('The provider response and stored payment state do not agree. Verify this transaction before retrying.');
      }
      setRefundPayment(null);
      setNoticeKind(result.refundStatus === 'failed' ? 'error' : result.refundStatus === 'pending' ? 'warning' : 'success');
      setNotice(result.refundStatus === 'processed'
        ? `Refund processed for payment ${String(refundPayment.paymentId)}.`
        : result.refundStatus === 'pending'
          ? `Refund request for payment ${String(refundPayment.paymentId)} is pending with the provider.`
          : `The provider reports that the refund failed for payment ${String(refundPayment.paymentId)}. The provider reference has been retained.`);
      await loadPayments(page);
    } catch (requestError) {
      setRefundPayment(null);
      setNoticeKind('error');
      setNotice(requestError.response?.data?.message || requestError.message || 'Refund outcome could not be confirmed. The payment has been refreshed; check Razorpay before retrying.');
      await loadPayments(page);
    } finally {
      setRefundBusy(false);
    }
  };

  const pageCount = pagination.totalPages || 0;

  return (
    <main className="payment-page">
      <header className="payment-page-header">
        <div>
          <span className="payment-eyebrow"><CreditCard size={14} /> Financial operations</span>
          <h1>Payments</h1>
          <p>Review transaction status, settlement references and recorded refunds.</p>
        </div>
        <button className="payment-button payment-button-secondary" type="button" onClick={() => loadPayments(page)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'payment-spin' : ''} /> Refresh
        </button>
      </header>

      {notice && <div className={`payment-notice payment-notice-${noticeKind}`} role={noticeKind === 'error' ? 'alert' : 'status'}>{noticeKind === 'error' ? <XCircle size={17} /> : <CheckCircle2 size={17} />}{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button></div>}

      <section className="payment-summary-grid" aria-label="Payment summaries">
        <SummaryCard label="Total payments" value={summary?.total} note="All recorded transactions" icon={CreditCard} tone="tone-blue" active={!filters.status} onClick={() => setStatus('')} />
        <SummaryCard label="Successful" value={summary?.successful} note="Captured transactions" icon={CheckCircle2} tone="tone-green" active={filters.status === 'success'} onClick={() => setStatus('success')} />
        <SummaryCard label="Pending" value={summary?.pending} note="Awaiting final result" icon={Clock3} tone="tone-amber" active={filters.status === 'pending'} onClick={() => setStatus('pending')} />
        <SummaryCard label="Failed" value={summary?.failed} note="Unsuccessful transactions" icon={XCircle} tone="tone-red" active={filters.status === 'failed'} onClick={() => setStatus('failed')} />
        <SummaryCard label="Refunded" value={summary?.refunded} note="Recorded full refunds" icon={FilterX} tone="tone-violet" active={filters.status === 'refunded'} onClick={() => setStatus('refunded')} />
        <SummaryCard label="Successful amount" value={summary?.successfulAmount} note="Less completed partial refunds" icon={CircleDollarSign} tone="tone-green" amount active={filters.status === 'success'} onClick={() => setStatus('success')} />
        <SummaryCard label="Refunded amount" value={summary?.refundedAmount} note="Recorded refund amounts" icon={ArrowDownUp} tone="tone-violet" amount active={filters.status === 'refunded'} onClick={() => setStatus('refunded')} />
      </section>

      <section className="payment-panel">
        <form className="payment-toolbar" onSubmit={submitSearch}>
          <label className="payment-search">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payment, booking, customer or gateway ID" aria-label="Search payments" />
            {search && <button type="button" onClick={() => { setSearch(''); setAppliedSearch(''); setPage(1); }} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <button className="payment-button payment-button-primary" type="submit" disabled={loading}><Search size={15} /> Search</button>
        </form>

        <div className="payment-filter-row">
          <label><span>Status</span><select value={filters.status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {(facets.statuses || ['pending', 'success', 'failed', 'refunded']).map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select></label>
          <label><span>Method</span><select value={filters.method} onChange={(event) => { setFilters((current) => ({ ...current, method: event.target.value })); setPage(1); }}>
            <option value="">All methods</option>
            {(facets.methods || []).map((method) => <option key={method} value={method}>{titleCase(method)}</option>)}
          </select></label>
          <label><span>Provider</span><select value={filters.provider} onChange={(event) => { setFilters((current) => ({ ...current, provider: event.target.value })); setPage(1); }}>
            <option value="">All providers</option>
            {(facets.providers || []).map((provider) => <option key={provider} value={provider}>{titleCase(provider)}</option>)}
          </select></label>
          <label><span>Date range · UTC</span><select value={period} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="">Any date</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="custom">Custom range</option>
          </select></label>
          {(period === 'custom' || (!period && (filters.from || filters.to))) && (
            <div className="payment-custom-dates">
              <label><span>From</span><input type="date" value={filters.from} onChange={(event) => updateDate('from', event.target.value)} /></label>
              <label><span>To</span><input type="date" value={filters.to} onChange={(event) => updateDate('to', event.target.value)} /></label>
            </div>
          )}
          <label><span>Sort by</span><select value={`${filters.sortBy}:${filters.sortOrder}`} onChange={(event) => {
            const [sortBy, sortOrder] = event.target.value.split(':');
            setFilters((current) => ({ ...current, sortBy, sortOrder }));
            setPage(1);
          }}>
            <option value="date:desc">Newest first</option><option value="date:asc">Oldest first</option>
            <option value="amount:desc">Amount: high to low</option><option value="amount:asc">Amount: low to high</option>
            <option value="status:asc">Status: A–Z</option><option value="status:desc">Status: Z–A</option>
          </select></label>
          {hasFilters && <button className="payment-clear-button" type="button" onClick={clearFilters}>Clear filters</button>}
        </div>

        <div className="payment-date-shortcuts" aria-label="Date shortcuts">
          <CalendarDays size={15} />
          <button type="button" className={period === 'today' ? 'is-active' : ''} onClick={() => setPeriodFilter('today')}>Today</button>
          <button type="button" className={period === '7' ? 'is-active' : ''} onClick={() => setPeriodFilter('7')}>7 days</button>
          <button type="button" className={period === '30' ? 'is-active' : ''} onClick={() => setPeriodFilter('30')}>30 days</button>
        </div>

        {error && <div className="payment-error" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={() => loadPayments(page)}>Retry</button></div>}

        <div className="payment-table-heading">
          <div><h2>Transaction records</h2><p>{loading ? 'Updating records…' : `${Number(pagination.total || 0).toLocaleString('en-IN')} matching transactions`}</p></div>
          <label className="payment-page-size">Rows
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="payment-table-scroll">
          <table className="payment-table">
            <thead><tr>
              <th>Payment</th><th>Booking</th><th>Customer</th><th>Amount</th><th>Method / Provider</th><th>Status</th><th>Transaction date</th><th>Refund</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? Array.from({ length: 5 }, (_, index) => <tr key={`loading-${index}`} className="payment-skeleton-row">{Array.from({ length: 9 }, (_, cell) => <td key={cell}><span /></td>)}</tr>)
                : error ? <tr><td className="payment-table-empty" colSpan="9">Payment records could not be loaded.</td></tr>
                  : payments.length === 0 ? <tr><td className="payment-table-empty" colSpan="9"><span className="payment-empty-icon"><CreditCard size={22} /></span><strong>No payments found</strong><span>Try adjusting your search or filters.</span></td></tr>
                    : payments.map((payment) => (
                      <tr key={payment.paymentId}>
                        <td><button className="payment-id-link" type="button" onClick={() => navigate(`/payments/${payment.paymentId}`)}>{String(payment.paymentId).slice(-8)}<ExternalLink size={13} /></button><small>{String(payment.paymentId)}</small></td>
                        <td><strong>{payment.booking?.bookingId || (typeof payment.bookingId === 'string' ? payment.bookingId : 'Not available')}</strong></td>
                        <td><strong>{payment.customer?.name || 'Not available'}</strong><small>{payment.customer?.phone || payment.customer?.email || 'Contact unavailable'}</small></td>
                        <td className="payment-amount">{formatMoney(payment.amount)}</td>
                        <td><strong>{titleCase(payment.method)}</strong><small>{payment.provider ? titleCase(payment.provider) : 'Provider not recorded'}</small></td>
                        <td><PaymentStatusBadge status={payment.status} /></td>
                        <td>{formatPaymentDate(paymentDate(payment))}</td>
                        <td>{payment.refundStatus ? <><PaymentStatusBadge status={payment.refundStatus} /><small>{payment.refundStatus === 'pending' ? `Requested ${formatMoney(payment.refundAmount)}` : payment.refundStatus === 'processed' ? `Processed ${formatMoney(payment.refundAmount)}` : 'Provider reported failure'}</small></> : Number(payment.refundAmount || 0) > 0 ? <><strong>{formatMoney(payment.refundAmount)}</strong><small>Recorded refund amount</small></> : <span className="payment-muted">No refund</span>}</td>
                        <td><div className="payment-row-actions">
                          <button type="button" className="payment-button payment-button-compact" onClick={() => navigate(`/payments/${payment.paymentId}`)}>Details</button>
                          {payment.refundEligible && <button type="button" className="payment-button payment-button-compact payment-button-danger-outline" onClick={() => setRefundPayment(payment)}>Refund</button>}
                        </div></td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <footer className="payment-pagination">
            <span>Showing {pagination.total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, pagination.total || 0)} of {Number(pagination.total || 0).toLocaleString('en-IN')}</span>
            <div><button type="button" onClick={() => { const next = Math.max(1, page - 1); setPage(next); }} disabled={page <= 1}>Previous</button><span>Page {page} of {Math.max(pageCount, 1)}</span><button type="button" onClick={() => { const next = Math.min(pageCount || 1, page + 1); setPage(next); }} disabled={pageCount === 0 || page >= pageCount}>Next</button></div>
          </footer>
        )}
      </section>
      {refundPayment && <PaymentRefundDialog payment={refundPayment} busy={refundBusy} onClose={() => setRefundPayment(null)} onConfirm={submitRefund} />}
    </main>
  );
}
