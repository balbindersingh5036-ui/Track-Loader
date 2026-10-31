import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Activity, CalendarDays, Clock3,
  CreditCard, RefreshCw, Search, ShieldCheck, UserRound, Users, Wallet, XCircle
} from 'lucide-react';
import customerService from '../../services/customerService';
import './customerDashboard.css';

const dateTimeLabel = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(date);
};

const dateLabel = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
};

const moneyLabel = (value) => {
  if (value === null || value === undefined || value === '') return 'Not available';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(amount);
};

const titleCase = (value) => value
  ? String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  : 'Not available';
const visibleBookingStatus = (booking) => (
  booking.assignmentStatus === 'rejected' && booking.bookingStatus === 'pending'
    ? 'rejected'
    : booking.bookingStatus
);

const initials = (name) => String(name || 'Customer')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0] || '')
  .join('')
  .toUpperCase();

function CustomerAvatar({ customer }) {
  return customer?.profileImage
    ? <img className="customer-avatar customer-avatar-small" src={customer.profileImage} alt="" />
    : <span className="customer-avatar customer-avatar-small customer-avatar-fallback" aria-label={`${customer?.name || 'Customer'} avatar`}>{initials(customer?.name)}</span>;
}

function DetailCard({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`customer-detail-card ${className}`}>
      <div className="customer-detail-card-heading"><span><Icon size={17} /></span><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function Field({ label, children, wide = false }) {
  return <div className={`customer-profile-field ${wide ? 'customer-profile-field-wide' : ''}`}><span>{label}</span><strong>{children || 'Not available'}</strong></div>;
}

function CustomerStatus({ active }) {
  return <span className={`customer-status-badge ${active ? 'is-active' : 'is-inactive'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

function StatusBadge({ status }) {
  const tone = status === 'completed' || status === 'accepted' ? 'is-active'
    : status === 'cancelled' || status === 'rejected' ? 'is-inactive' : 'is-neutral';
  return <span className={`customer-status-badge ${tone}`}>{titleCase(status)}</span>;
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [stats, setStats] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookings, setBookings] = useState([]);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingSearchInput, setBookingSearchInput] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [bookingPages, setBookingPages] = useState({ total: 0, totalPages: 1 });
  const [bookingLoading, setBookingLoading] = useState(true);
  const [bookingError, setBookingError] = useState('');
  const [payments, setPayments] = useState([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPages, setPaymentPages] = useState({ total: 0, totalPages: 1 });
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadCustomer = useCallback(async () => {
    setPageLoading(true);
    setPageError('');
    try {
      const response = await customerService.getCustomer(id);
      const data = response.data?.data;
      if (!data?.customer || !data?.stats?.bookings) throw new Error('The customer details API returned an unexpected response.');
      setCustomer(data.customer);
      setStats(data.stats);
      return true;
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || requestError.message || 'Unable to load customer details.');
      return false;
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  const loadBookings = useCallback(async () => {
    setBookingLoading(true);
    setBookingError('');
    try {
      const params = { page: bookingPage, limit: 10 };
      if (bookingStatus) params.bookingStatus = bookingStatus;
      if (bookingSearch) params.search = bookingSearch;
      const response = await customerService.getBookings(id, params);
      const data = response.data?.data;
      if (!Array.isArray(data?.bookings) || !data?.pagination) throw new Error('Unexpected customer booking response.');
      setBookings(data.bookings);
      setBookingPages(data.pagination);
    } catch (requestError) {
      setBookings([]);
      setBookingError(requestError.response?.data?.message || requestError.message || 'Unable to load customer bookings.');
    } finally {
      setBookingLoading(false);
    }
  }, [bookingPage, bookingSearch, bookingStatus, id]);

  const loadPayments = useCallback(async () => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const response = await customerService.getPayments(id, { page: paymentPage, limit: 10 });
      const data = response.data?.data;
      if (!Array.isArray(data?.payments) || !data?.pagination) throw new Error('Unexpected customer payment response.');
      setPayments(data.payments);
      setPaymentPages(data.pagination);
    } catch (requestError) {
      setPayments([]);
      setPaymentError(requestError.response?.data?.message || requestError.message || 'Unable to load customer payments.');
    } finally {
      setPaymentLoading(false);
    }
  }, [id, paymentPage]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);
  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  const toggleStatus = async () => {
    if (!customer || statusUpdating) return;
    const nextActive = !customer.isActive;
    if (!window.confirm(`Change ${customer.name || 'this customer'} from ${customer.isActive ? 'Active' : 'Inactive'} to ${nextActive ? 'Active' : 'Inactive'}?`)) return;
    setStatusUpdating(true);
    setPageError('');
    setNotice('');
    try {
      await customerService.updateStatus(customer.id, nextActive);
      if (!(await loadCustomer())) return;
      setNotice(`${customer.name || 'Customer'} is now ${nextActive ? 'active' : 'inactive'}.`);
    } catch (requestError) {
      setPageError(requestError.response?.data?.message || requestError.message || 'Unable to update customer status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const submitBookingSearch = (event) => {
    event.preventDefault();
    setBookingSearch(bookingSearchInput.trim());
    setBookingPage(1);
  };

  const activities = useMemo(() => {
    if (!customer) return [];
    const events = [];
    if (customer.createdAt) events.push({ label: 'Customer registered', date: customer.createdAt });
    if (customer.lastLoginAt) events.push({ label: 'Most recent login', date: customer.lastLoginAt });
    bookings.forEach((booking) => {
      const historyActions = new Set((booking.assignmentHistory || []).map((entry) => entry.action));
      (booking.assignmentHistory || []).forEach((entry) => {
        if (entry.occurredAt) {
          events.push({
            label: `${titleCase(entry.action)} · ${booking.bookingId || 'Booking'}${entry.actorRole ? ` (${titleCase(entry.actorRole)})` : ''}`,
            date: entry.occurredAt
          });
        }
      });
      if (booking.createdAt && !historyActions.has('created')) events.push({ label: `Booking created · ${booking.bookingId || 'Booking'}`, date: booking.createdAt });
      if (booking.cancelledAt && !historyActions.has('cancelled')) events.push({ label: `Booking cancelled · ${booking.bookingId || 'Booking'}`, date: booking.cancelledAt });
      if (booking.acceptedAt && !historyActions.has('accepted')) events.push({ label: `Driver accepted · ${booking.bookingId || 'Booking'}`, date: booking.acceptedAt });
      if (booking.completedAt && !historyActions.has('completed')) events.push({ label: `Trip completed · ${booking.bookingId || 'Booking'}`, date: booking.completedAt });
    });
    payments.forEach((payment) => {
      if (payment.createdAt) events.push({ label: `Payment record · ${payment.booking?.bookingId || payment.transactionId || 'Payment'}`, date: payment.createdAt });
      if (payment.paidAt) events.push({ label: `${titleCase(payment.status)} payment timestamp · ${payment.booking?.bookingId || payment.transactionId || 'Payment'}`, date: payment.paidAt });
      if (payment.refundedAt) events.push({ label: `Refund recorded · ${payment.booking?.bookingId || payment.refundId || 'Refund'}`, date: payment.refundedAt });
    });
    return events.sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 12);
  }, [bookings, customer, payments]);

  if (pageLoading && !customer) {
    return <main className="customer-page"><div className="customer-state"><span className="customer-loader" />Loading customer profile…</div></main>;
  }
  if (pageError && !customer) {
    return <main className="customer-page"><div className="customer-alert" role="alert"><XCircle size={18} /><span>{pageError}</span><button type="button" onClick={loadCustomer}>Retry</button></div><button className="customer-button customer-button-secondary" type="button" onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to customers</button></main>;
  }
  if (!customer) return null;

  const bookingStats = stats?.bookings || {};
  const metrics = [
    { label: 'Total bookings', value: bookingStats.total },
    { label: 'Pending', value: bookingStats.pending },
    { label: 'Accepted', value: bookingStats.accepted },
    { label: 'Rejected', value: bookingStats.rejected },
    { label: 'In progress', value: bookingStats.inProgress },
    { label: 'Completed', value: bookingStats.completed },
    { label: 'Cancelled', value: bookingStats.cancelled }
  ];
  const bookingStatusFilters = [
    ['All', ''], ['Pending', 'pending'], ['Rejected', 'rejected'], ['Accepted', 'accepted'],
    ['In progress', 'in-progress'], ['Completed', 'completed'], ['Cancelled', 'cancelled']
  ];

  return (
    <main className="customer-page">
      <header className="customer-detail-header">
        <div className="customer-detail-actions">
          <button className="customer-button customer-button-secondary" type="button" onClick={() => navigate('/customers')}><ArrowLeft size={16} /> Back to customers</button>
          <button className="customer-button customer-button-secondary" type="button" onClick={() => { loadCustomer(); loadBookings(); loadPayments(); }} disabled={pageLoading || bookingLoading || paymentLoading}>
            <RefreshCw size={15} className={pageLoading || bookingLoading || paymentLoading ? 'customer-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="customer-detail-title-row">
          <CustomerAvatar customer={customer} />
          <div className="customer-detail-title-copy">
            <span className="customer-eyebrow">CUSTOMER PROFILE</span>
            <h1>{customer.name || 'Name unavailable'}</h1>
            <div className="customer-detail-title-meta">
              <span>ID · {customer.id}</span>
              <CustomerStatus active={customer.isActive} />
              <span>Joined {dateLabel(customer.createdAt)}</span>
            </div>
          </div>
          <button className="customer-button customer-button-primary" type="button" onClick={toggleStatus} disabled={statusUpdating}>
            <ShieldCheck size={15} />{statusUpdating ? 'Updating…' : customer.isActive ? 'Deactivate account' : 'Activate account'}
          </button>
        </div>
      </header>

      {pageError && <div className="customer-alert" role="alert"><XCircle size={18} /><span>{pageError}</span><button type="button" onClick={loadCustomer}>Retry</button></div>}
      {notice && <div className="customer-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}

      <div className="customer-detail-grid">
        <DetailCard title="Customer information" icon={UserRound}>
          <div className="customer-profile-grid">
            <Field label="Full name">{customer.name}</Field>
            <Field label="Customer ID">{customer.id}</Field>
            <Field label="Email">{customer.email}</Field>
            <Field label="Phone number">{customer.phone}</Field>
            <Field label="Account status">{customer.isActive ? 'Active' : 'Inactive'}</Field>
            <Field label="Registered">{dateTimeLabel(customer.createdAt)}</Field>
            <Field label="Last login">{dateTimeLabel(customer.lastLoginAt)}</Field>
            {customer.profileImage && <Field label="Profile image" wide><img className="customer-profile-image" src={customer.profileImage} alt={`${customer.name || 'Customer'} profile`} /></Field>}
          </div>
        </DetailCard>

        <DetailCard title="Customer statistics" icon={Activity}>
          <div className="customer-metric-grid">
            {metrics.map((metric) => <div className="customer-metric" key={metric.label}><span>{metric.label}</span><strong>{Number(metric.value ?? 0).toLocaleString('en-IN')}</strong></div>)}
            <div className="customer-metric"><span>Net amount paid</span><strong>{moneyLabel(stats?.totalNetPaid)}</strong></div>
          </div>
          <p className="customer-metric-note">Net amount is calculated from recorded successful/refunded payment transactions minus recorded refunds.</p>
        </DetailCard>

        <DetailCard title="Booking history" icon={CalendarDays} className="customer-detail-span-two">
          <div className="customer-history-controls">
            <div className="customer-history-tabs" role="group" aria-label="Filter booking history">
              {bookingStatusFilters.map(([label, value]) => (
                <button className={`customer-history-tab ${bookingStatus === value ? 'is-active' : ''}`} type="button" key={label} onClick={() => { setBookingStatus(value); setBookingPage(1); }}>{label}</button>
              ))}
            </div>
            <form className="customer-history-search-form" onSubmit={submitBookingSearch}>
              <label className="customer-history-search-box"><Search size={14} /><input aria-label="Search booking reference" placeholder="Search reference" value={bookingSearchInput} onChange={(event) => setBookingSearchInput(event.target.value)} /></label>
              <button type="submit" className="customer-button customer-button-secondary">Search</button>
            </form>
          </div>
          {bookingError && <div className="customer-inline-error" role="alert"><span>{bookingError}</span><button type="button" onClick={loadBookings}>Retry</button></div>}
          {bookingLoading ? <div className="customer-state customer-state-compact"><span className="customer-loader" />Loading booking history…</div> : bookingError ? null : bookings.length ? (
            <div className="customer-table-scroll">
              <table className="customer-table customer-booking-table">
                <thead><tr><th>Reference</th><th>Booking date</th><th>Route</th><th>Service</th><th>Agency</th><th>Driver</th><th>Fare</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{bookings.map((booking) => (
                  <tr key={booking._id}>
                    <td><button type="button" className="customer-booking-link" onClick={() => navigate(`/bookings/${booking._id}`)}>{booking.bookingId}</button></td>
                    <td>{dateLabel(booking.createdAt)}</td>
                    <td className="customer-route-cell"><span title={booking.pickup?.address}>{booking.pickup?.address || 'Not available'}</span><span className="customer-route-arrow">↓</span><span title={booking.drop?.address}>{booking.drop?.address || 'Not available'}</span></td>
                    <td>{titleCase(booking.vehicleType)}<span className="customer-cell-subtext">{titleCase(booking.bookingMode)}</span></td>
                    <td>{booking.agency?.agencyName || 'Not assigned'}</td>
                    <td>{booking.driver?.fullName || 'Not assigned'}</td>
                    <td><strong>{moneyLabel(booking.finalFare)}</strong><span className="customer-cell-subtext">Est. {moneyLabel(booking.estimatedFare)}</span></td>
                    <td>{titleCase(booking.paymentStatus)}</td>
                    <td><StatusBadge status={visibleBookingStatus(booking)} /></td>
                    <td><button type="button" className="customer-row-action" onClick={() => navigate(`/bookings/${booking._id}`)}>View</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="customer-state customer-state-compact"><CalendarDays size={23} /><strong>No bookings found</strong><span>No records match this customer and filter.</span></div>}
          <footer className="customer-section-pagination"><span>{bookingPages.total || 0} bookings · Page {bookingPage} of {Math.max(bookingPages.totalPages || 1, 1)}</span><div><button type="button" className="customer-button customer-button-secondary" disabled={bookingPage <= 1 || bookingLoading} onClick={() => setBookingPage((current) => Math.max(1, current - 1))}>Previous</button><button type="button" className="customer-button customer-button-secondary" disabled={bookingPage >= bookingPages.totalPages || bookingLoading} onClick={() => setBookingPage((current) => Math.min(bookingPages.totalPages || 1, current + 1))}>Next</button></div></footer>
        </DetailCard>

        <DetailCard title="Payment history" icon={Wallet} className="customer-detail-span-two">
          {paymentError && <div className="customer-inline-error" role="alert"><span>{paymentError}</span><button type="button" onClick={loadPayments}>Retry</button></div>}
          {paymentLoading ? <div className="customer-state customer-state-compact"><span className="customer-loader" />Loading payment history…</div> : paymentError ? null : payments.length ? (
            <div className="customer-table-scroll">
              <table className="customer-table customer-payment-table">
                <thead><tr><th>Transaction reference</th><th>Booking reference</th><th>Amount</th><th>Method</th><th>Status</th><th>Transaction date</th><th>Refund status</th></tr></thead>
                <tbody>{payments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{payment.transactionId || payment.orderId || 'Not available'}</td>
                    <td>{payment.booking?.bookingId ? <button className="customer-booking-link" type="button" onClick={() => navigate(`/bookings/${payment.booking._id}`)}>{payment.booking.bookingId}</button> : 'Not available'}</td>
                    <td>{moneyLabel(payment.amount)}</td>
                    <td>{titleCase(payment.method)}</td>
                    <td><StatusBadge status={payment.status} /></td>
                    <td>{dateTimeLabel(payment.paidAt || payment.createdAt)}</td>
                    <td>{payment.status === 'refunded' ? `Refunded · ${moneyLabel(payment.refundAmount)}` : payment.refundAmount > 0 ? `Partial · ${moneyLabel(payment.refundAmount)}` : 'Not refunded'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="customer-state customer-state-compact"><CreditCard size={23} /><strong>No payment records found</strong><span>Payment history is shown only when actual transaction records exist.</span></div>}
          <footer className="customer-section-pagination"><span>{paymentPages.total || 0} payments · Page {paymentPage} of {Math.max(paymentPages.totalPages || 1, 1)}</span><div><button type="button" className="customer-button customer-button-secondary" disabled={paymentPage <= 1 || paymentLoading} onClick={() => setPaymentPage((current) => Math.max(1, current - 1))}>Previous</button><button type="button" className="customer-button customer-button-secondary" disabled={paymentPage >= paymentPages.totalPages || paymentLoading} onClick={() => setPaymentPage((current) => Math.min(paymentPages.totalPages || 1, current + 1))}>Next</button></div></footer>
        </DetailCard>

        <DetailCard title="Recent recorded activity" icon={Clock3}>
          {activities.length ? (
            <div className="customer-activity-list">{activities.map((activity, index) => (
              <div className="customer-activity-item" key={`${activity.label}-${activity.date}-${index}`}><span className="customer-activity-dot" /><div className="customer-activity-copy"><strong>{activity.label}</strong><span>{dateTimeLabel(activity.date)}</span></div></div>
            ))}</div>
          ) : <div className="customer-state customer-state-compact"><Clock3 size={22} /><span>No persisted activity timestamps are available.</span></div>}
        </DetailCard>
      </div>
      <p className="customer-data-note"><Users size={14} /> Booking and payment records are matched by the stored customer ID. Activity includes persisted timestamps from the currently loaded history pages only.</p>
    </main>
  );
}
