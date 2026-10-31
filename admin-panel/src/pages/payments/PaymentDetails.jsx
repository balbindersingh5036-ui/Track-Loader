import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarClock, CheckCircle2, CircleDollarSign, Clipboard,
  CreditCard, ExternalLink, MapPin, RefreshCw, ShieldAlert,
  UserRound, Wallet, XCircle
} from 'lucide-react';
import paymentService from '../../services/paymentService';
import PaymentRefundDialog from './PaymentRefundDialog';
import PaymentStatusBadge from './PaymentStatusBadge';
import { formatMoney, formatPaymentDate, paymentDate, titleCase } from './paymentDisplay';
import './paymentDashboard.css';

function DetailCard({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`payment-detail-card ${className}`}>
      <header><span><Icon size={17} /></span><h2>{title}</h2></header>
      {children}
    </section>
  );
}

function DetailField({ label, children, wide = false }) {
  return (
    <div className={`payment-detail-field ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <strong>{children === null || children === undefined || children === '' ? 'Not available' : children}</strong>
    </div>
  );
}

function CopyValue({ value, label, onCopy }) {
  const actual = value || '';
  return (
    <span className="payment-copy-value">
      <code>{actual || 'Not available'}</code>
      {actual && <button type="button" onClick={() => onCopy(actual, label)} aria-label={`Copy ${label}`} title={`Copy ${label}`}><Clipboard size={14} /></button>}
    </span>
  );
}

export default function PaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundNotice, setRefundNotice] = useState('');
  const [refundNoticeKind, setRefundNoticeKind] = useState('success');

  const loadPayment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await paymentService.getPayment(id);
      const value = response.data?.data?.payment;
      if (!value) throw new Error('The payment API did not return this payment.');
      setPayment(value);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPayment(); }, [loadPayment]);

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopyNotice(`${label} copied.`);
    } catch {
      setCopyNotice(`Unable to copy ${label}. Select and copy the value instead.`);
    }
    window.setTimeout(() => setCopyNotice(''), 3500);
  };

  const submitRefund = async () => {
    if (!refundPayment || refundBusy) return;
    setRefundBusy(true);
    setRefundNotice('');
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
      setRefundNoticeKind(result.refundStatus === 'failed' ? 'error' : result.refundStatus === 'pending' ? 'warning' : 'success');
      setRefundNotice(result.refundStatus === 'processed'
        ? 'Refund processed by the payment provider.'
        : result.refundStatus === 'pending'
          ? 'Refund request is pending with the payment provider.'
          : 'The provider reports that the refund failed. The provider reference has been retained.');
      await loadPayment();
    } catch (requestError) {
      setRefundPayment(null);
      setRefundNoticeKind('error');
      setRefundNotice(requestError.response?.data?.message || requestError.message || 'Refund outcome could not be confirmed. Payment details were refreshed; check Razorpay before retrying.');
      await loadPayment();
    } finally {
      setRefundBusy(false);
    }
  };

  if (loading && !payment) {
    return <main className="payment-page"><div className="payment-state"><span className="payment-loader" />Loading payment details…</div></main>;
  }
  if (error && !payment) {
    return (
      <main className="payment-page">
        <div className="payment-error" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={loadPayment}>Retry</button></div>
        <button className="payment-button payment-button-secondary" type="button" onClick={() => navigate('/payments')}><ArrowLeft size={16} /> Back to payments</button>
      </main>
    );
  }
  if (!payment) return null;

  const customer = payment.customer;
  const booking = payment.booking;
  const refundAmount = Number(payment.refundAmount || 0);
  const hasRefund = Boolean(payment.refundId || payment.refundStatus || refundAmount > 0 || payment.refundInitiatedAt || payment.refundedAt);
  const gatewayFields = [
    ['Provider', payment.provider ? titleCase(payment.provider) : 'Not available'],
    ['Gateway order ID', payment.orderId, true],
    ['Gateway payment / transaction ID', payment.transactionId, true],
    ['Gateway refund reference', payment.refundId, true],
    ['Refund provider status', payment.refundStatus ? titleCase(payment.refundStatus) : 'Not available'],
    ['Payment method', titleCase(payment.method)],
    ['Gateway status', titleCase(payment.status)],
    ['Transaction created', formatPaymentDate(payment.createdAt)],
    ['Transaction updated', formatPaymentDate(payment.updatedAt)]
  ];

  return (
    <main className="payment-page payment-details-page">
      <header className="payment-detail-header">
        <div className="payment-detail-header-top">
          <button className="payment-button payment-button-secondary" type="button" onClick={() => navigate('/payments')}><ArrowLeft size={16} /> Back to payments</button>
          <button className="payment-button payment-button-secondary" type="button" onClick={loadPayment} disabled={loading}><RefreshCw size={16} className={loading ? 'payment-spin' : ''} /> Refresh</button>
        </div>
        <div className="payment-detail-heading">
          <div className="payment-detail-title">
            <span className="payment-eyebrow">Transaction details</span>
            <h1>Payment <code>{String(payment.paymentId)}</code></h1>
            <div className="payment-detail-subline"><PaymentStatusBadge status={payment.status} /><span><CalendarClock size={15} />{formatPaymentDate(paymentDate(payment))}</span></div>
            <span className="payment-detail-booking">Booking reference: <strong>{booking?.bookingId || (typeof payment.bookingId === 'string' ? payment.bookingId : 'Not available')}</strong></span>
          </div>
          <div className="payment-detail-amount">
            <span>Recorded payment amount</span>
            <strong>{formatMoney(payment.amount)}</strong>
            <span>Currency: INR</span>
          </div>
        </div>
      </header>

      {(error || refundNotice || copyNotice) && (
        <div className={`${error ? 'payment-error' : `payment-notice payment-notice-${refundNotice ? refundNoticeKind : 'success'}`}`} role={error || refundNoticeKind === 'error' ? 'alert' : 'status'}>
          {error || refundNoticeKind === 'error' ? <XCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{error || refundNotice || copyNotice}</span>
          {error && <button type="button" onClick={loadPayment}>Retry</button>}
          {!error && <button type="button" onClick={() => { setRefundNotice(''); setCopyNotice(''); }} aria-label="Dismiss message">×</button>}
        </div>
      )}

      <div className="payment-detail-grid">
        <DetailCard title="Payment overview" icon={Wallet} className="payment-overview-card">
          <div className={`payment-overview-hero is-${payment.status || 'unknown'}`}>
            <span>Transaction amount</span><strong>{formatMoney(payment.amount)}</strong>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <div className="payment-detail-fields">
            <DetailField label="Payment method">{titleCase(payment.method)}</DetailField>
            <DetailField label="Payment provider">{payment.provider ? titleCase(payment.provider) : null}</DetailField>
            <DetailField label="Booking reference">{booking?.bookingId || (typeof payment.bookingId === 'string' ? payment.bookingId : null)}</DetailField>
          </div>
        </DetailCard>

        <DetailCard title="Customer information" icon={UserRound}>
          <div className="payment-detail-fields">
            <DetailField label="Customer name">{customer?.name}</DetailField>
            <DetailField label="Customer ID">{customer?.id ? <CopyValue value={customer.id} label="customer ID" onCopy={copyValue} /> : null}</DetailField>
            <DetailField label="Phone">{customer?.phone}</DetailField>
            <DetailField label="Email">{customer?.email}</DetailField>
            <DetailField label="Booking reference" wide>{booking?.bookingId || (typeof payment.bookingId === 'string' ? payment.bookingId : null)}</DetailField>
          </div>
        </DetailCard>

        <DetailCard title="Booking information" icon={MapPin} className="payment-booking-card">
          {booking ? (
            <>
              <div className="payment-detail-fields">
                <DetailField label="Booking reference">{booking.bookingId}</DetailField>
                <DetailField label="Booking status">{titleCase(booking.bookingStatus)}</DetailField>
                <DetailField label="Pickup" wide>{booking.pickup?.address}</DetailField>
                <DetailField label="Drop" wide>{booking.drop?.address}</DetailField>
                <DetailField label="Booking mode">{titleCase(booking.bookingMode)}</DetailField>
                <DetailField label="Vehicle category">{titleCase(booking.vehicleType)}</DetailField>
                <DetailField label="Estimated fare">{booking.estimatedFare === null || booking.estimatedFare === undefined ? null : formatMoney(booking.estimatedFare)}</DetailField>
                <DetailField label="Final fare">{booking.finalFare === null || booking.finalFare === undefined ? null : formatMoney(booking.finalFare)}</DetailField>
                <DetailField label="Scheduled pickup" wide>
                  {booking.preferredPickupDate ? `${formatPaymentDate(booking.preferredPickupDate)}${booking.preferredPickupTime ? ` · ${booking.preferredPickupTime}` : ''}` : null}
                </DetailField>
              </div>
              {booking.id && <button className="payment-text-link" type="button" onClick={() => navigate(`/bookings/${booking.id}`)}>View booking details <ExternalLink size={14} /></button>}
            </>
          ) : <p className="payment-unavailable">The related booking record is unavailable.</p>}
        </DetailCard>

        <DetailCard title="Payment gateway information" icon={CreditCard} className="payment-gateway-card">
          <div className="payment-detail-fields">
            {gatewayFields.map(([label, value, copyable]) => (
              <DetailField label={label} key={label} wide={Boolean(copyable)}>
                {copyable ? <CopyValue value={value} label={label.toLowerCase()} onCopy={copyValue} /> : value}
              </DetailField>
            ))}
          </div>
          <p className="payment-security-note"><ShieldAlert size={15} /> Gateway credentials and signatures are not exposed in this view.</p>
        </DetailCard>

        <DetailCard title="Refund summary" icon={RefreshCw}>
          {!hasRefund ? (
            <div className="payment-no-refund"><span><CheckCircle2 size={19} /></span><div><strong>No Refund Initiated</strong><p>No refund record is stored for this payment.</p></div></div>
          ) : (
            <div className="payment-detail-fields">
              <DetailField label="Payment status"><PaymentStatusBadge status={payment.status} /></DetailField>
              <DetailField label="Refund provider status">{payment.refundStatus ? <PaymentStatusBadge status={payment.refundStatus} /> : null}</DetailField>
              <DetailField label="Refund ID">{payment.refundId ? <CopyValue value={payment.refundId} label="refund ID" onCopy={copyValue} /> : null}</DetailField>
              <DetailField label={payment.refundStatus === 'pending' ? 'Requested refund amount' : 'Processed refund amount'}>{formatMoney(payment.refundAmount)}</DetailField>
              <DetailField label={payment.refundStatus === 'processed' ? 'Refund processed date' : 'Refund initiated date'}>{formatPaymentDate(payment.refundedAt || payment.refundInitiatedAt)}</DetailField>
              <DetailField label="Refund reason">Not stored by the current payment model</DetailField>
              <DetailField label="Gateway refund reference">{payment.refundId}</DetailField>
            </div>
          )}
          {payment.refundEligible && <button type="button" className="payment-button payment-button-danger payment-refund-action" onClick={() => setRefundPayment(payment)}>Refund full payment</button>}
        </DetailCard>

        <DetailCard title="Payment breakdown" icon={CircleDollarSign}>
          <div className="payment-breakdown">
            <div><span>Estimated booking fare</span><strong>{booking?.estimatedFare === null || booking?.estimatedFare === undefined ? 'Not available' : formatMoney(booking.estimatedFare)}</strong></div>
            <div><span>Final booking fare</span><strong>{booking?.finalFare === null || booking?.finalFare === undefined ? 'Not available' : formatMoney(booking.finalFare)}</strong></div>
            <div><span>Actual payment amount</span><strong>{formatMoney(payment.amount)}</strong></div>
            <div><span>{payment.refundStatus === 'pending' ? 'Requested refund amount' : 'Processed amount refunded'}</span><strong>{payment.refundAmount === null || payment.refundAmount === undefined ? 'Not available' : formatMoney(payment.refundAmount)}</strong></div>
            <p>Separate tax, discount, surcharge and settlement breakdowns are not stored in the current payment record.</p>
          </div>
        </DetailCard>
      </div>
      {refundPayment && <PaymentRefundDialog payment={refundPayment} busy={refundBusy} onClose={() => setRefundPayment(null)} onConfirm={submitRefund} />}
    </main>
  );
}
