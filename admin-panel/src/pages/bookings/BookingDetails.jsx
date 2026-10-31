import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, CalendarDays, Check, Clock3, CreditCard,
  MapPin, RefreshCw, Route, UserRound, Truck, Wallet, XCircle
} from 'lucide-react';
import bookingService from '../../services/bookingService';
import { AssignmentStatusBadge, BookingStatusBadge } from './BookingBadges';
import {
  formatMoney, formatScheduledDate, formatScheduledTime, formatTimestamp, titleCase
} from './bookingDisplay';
import './bookingDashboard.css';

const relationName = (relation, field) => relation?.[field] || 'Not assigned';
const historyEvent = (booking, action, actorRole) => (booking.assignmentHistory || [])
  .filter((entry) => entry.action === action && (!actorRole || entry.actorRole === actorRole))
  .sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0))[0];
const relationIdExists = (relation) => Boolean(relation && (typeof relation === 'object' ? relation._id : relation));

function InfoField({ label, children, wide = false }) {
  return (
    <div className={`booking-info-field ${wide ? 'booking-info-field-wide' : ''}`}>
      <span>{label}</span>
      <strong>{children || 'Not available'}</strong>
    </div>
  );
}

function BookingCard({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`booking-detail-card ${className}`}>
      <div className="booking-detail-card-heading"><span><Icon size={17} /></span><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function BookingTimeline({ booking }) {
  const assignedEvent = historyEvent(booking, 'assigned');
  const acceptedEvent = historyEvent(booking, 'accepted');
  const stages = [
    { label: 'Booking created', complete: Boolean(booking.createdAt), at: booking.createdAt },
    { label: 'Agency assigned', complete: relationIdExists(booking.agency), at: assignedEvent?.occurredAt },
    { label: 'Driver assigned', complete: relationIdExists(booking.driver), at: assignedEvent?.occurredAt },
    { label: 'Driver accepted', complete: ['accepted', 'in-progress', 'completed'].includes(booking.bookingStatus) || booking.assignmentStatus === 'accepted', at: booking.acceptedAt || acceptedEvent?.occurredAt },
    { label: 'Trip started', complete: Boolean(booking.startedAt), at: booking.startedAt },
    { label: 'Trip completed', complete: Boolean(booking.completedAt), at: booking.completedAt }
  ];
  const terminalEvent = booking.bookingStatus === 'cancelled'
    ? { label: 'Booking cancelled', date: booking.cancelledAt, icon: XCircle }
    : booking.bookingStatus === 'rejected'
      ? { label: 'Driver rejected', date: historyEvent(booking, 'rejected')?.occurredAt, icon: XCircle }
      : null;

  return (
    <BookingCard title="Booking lifecycle" icon={Route} className="booking-timeline-card">
      <div className="booking-timeline" aria-label="Booking lifecycle timeline">
        {stages.map((stage, index) => (
          <div className={`booking-timeline-stage ${stage.complete ? 'is-complete' : ''}`} key={stage.label}>
            <span className="booking-timeline-marker">{stage.complete ? <Check size={14} /> : index + 1}</span>
            <div className="booking-timeline-copy">
              <strong>{stage.label}</strong>
              <span>{stage.at ? formatTimestamp(stage.at) : stage.complete ? 'Timestamp unavailable' : 'Not reached'}</span>
            </div>
          </div>
        ))}
      </div>
      {terminalEvent && (
        <div className="booking-terminal-event">
          <terminalEvent.icon size={16} />
          <strong>{terminalEvent.label}</strong>
          <span>{formatTimestamp(terminalEvent.date)}</span>
        </div>
      )}
    </BookingCard>
  );
}

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingService.getBooking(id);
      const data = response.data?.data;
      if (!data?.booking) throw new Error('The booking API did not return this booking.');
      setBooking(data.booking);
      setPayment(data.payment || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load booking details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadBooking(); }, [loadBooking]);

  if (loading && !booking) {
    return <main className="booking-page"><div className="booking-state"><span className="booking-loader" />Loading booking details…</div></main>;
  }
  if (error && !booking) {
    return (
      <main className="booking-page">
        <div className="booking-alert" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={loadBooking}>Retry</button></div>
        <button className="booking-button booking-button-secondary" type="button" onClick={() => navigate('/bookings')}><ArrowLeft size={16} /> Back to bookings</button>
      </main>
    );
  }
  if (!booking) return null;

  const rejectedEvent = historyEvent(booking, 'rejected');
  const cancelledEvent = historyEvent(booking, 'cancelled');
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'browser time zone';
  const bookingDate = formatTimestamp(booking.createdAt);
  const paidDate = payment?.paidAt ? formatTimestamp(payment.paidAt) : 'Not available';

  return (
    <main className="booking-page">
      <header className="booking-detail-header">
        <div className="booking-detail-heading-row">
          <button className="booking-button booking-button-secondary" type="button" onClick={() => navigate('/bookings')}><ArrowLeft size={16} /> Back to bookings</button>
          <button className="booking-button booking-button-secondary" type="button" onClick={loadBooking} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'booking-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="booking-detail-title-row">
          <div>
            <span className="booking-eyebrow">BOOKING DETAILS</span>
            <h1>{booking.bookingId || 'Booking record'}</h1>
            <p>Created {bookingDate}</p>
          </div>
          <div className="booking-header-badges">
            <BookingStatusBadge booking={booking} />
            <AssignmentStatusBadge status={booking.assignmentStatus} />
            <span className={`booking-badge ${booking.bookingMode === 'scheduled' ? 'booking-badge-info' : 'booking-badge-neutral'}`}>{titleCase(booking.bookingMode)} booking</span>
          </div>
        </div>
        <p className="booking-readonly-note">Read-only operations view · No booking actions are available from the Admin Panel.</p>
      </header>

      {error && <div className="booking-alert" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={loadBooking}>Retry</button></div>}

      <BookingTimeline booking={booking} />

      <div className="booking-details-grid">
        <BookingCard title="Customer" icon={UserRound}>
          <div className="booking-info-grid">
            <InfoField label="Customer name">{booking.customer?.name || 'Customer unavailable'}</InfoField>
            <InfoField label="Phone number">{booking.customer?.phone}</InfoField>
            <InfoField label="Email">{booking.customer?.email}</InfoField>
            <InfoField label="Customer ID">{booking.customer?._id}</InfoField>
            <InfoField label="Booking created">{bookingDate}</InfoField>
          </div>
        </BookingCard>

        <BookingCard title="Route and trip details" icon={MapPin} className="booking-route-detail-card">
          <div className="booking-route-visual">
            <div className="booking-route-point"><span className="booking-route-dot pickup-dot" /><div><small>PICKUP</small><strong>{booking.pickup?.address || 'Not available'}</strong></div></div>
            <span className="booking-route-connector"><ArrowDown size={16} /></span>
            <div className="booking-route-point"><span className="booking-route-dot drop-dot" /><div><small>DROP-OFF</small><strong>{booking.drop?.address || 'Not available'}</strong></div></div>
          </div>
          <div className="booking-info-grid booking-info-grid-route">
            <InfoField label="Scheduled date">{formatScheduledDate(booking.preferredPickupDate)}</InfoField>
            <InfoField label="Scheduled time">{formatScheduledTime(booking.preferredPickupTime)}</InfoField>
            <InfoField label="Booking mode">{titleCase(booking.bookingMode)}</InfoField>
            <InfoField label="Vehicle category">{titleCase(booking.vehicleType)}</InfoField>
            <InfoField label="Goods description" wide>{booking.goods}</InfoField>
            <InfoField label="Weight / capacity">{booking.weight?.value === null || booking.weight?.value === undefined ? 'Not available' : `${booking.weight.value} ${booking.weight.unit || ''}`}</InfoField>
            <InfoField label="Trip distance">{booking.distanceKm === null || booking.distanceKm === undefined ? 'Not available' : `${booking.distanceKm} km`}</InfoField>
          </div>
        </BookingCard>

        <BookingCard title="Agency" icon={Truck}>
          <div className="booking-info-grid">
            <InfoField label="Agency name">{booking.agency?.agencyName || 'Not assigned'}</InfoField>
            <InfoField label="Agency owner">{booking.agency?.owner?.name}</InfoField>
            <InfoField label="Agency phone">{booking.agency?.phone}</InfoField>
            <InfoField label="Agency email">{booking.agency?.email}</InfoField>
            <InfoField label="Agency status">{titleCase(booking.agency?.approvalStatus)}</InfoField>
          </div>
        </BookingCard>

        <BookingCard title="Assigned driver" icon={UserRound}>
          <div className="booking-info-grid">
            <InfoField label="Driver">{relationName(booking.driver, 'fullName')}</InfoField>
            <InfoField label="Phone">{booking.driver?.phone}</InfoField>
            <InfoField label="Driver verification">{titleCase(booking.driver?.approvalStatus)}</InfoField>
            <InfoField label="Agency association">{titleCase(booking.driver?.agencyAssociation?.status)}</InfoField>
            <InfoField label="Assignment">{relationIdExists(booking.driver) ? 'Assigned' : 'Not assigned'}</InfoField>
          </div>
        </BookingCard>

        <BookingCard title="Assigned vehicle" icon={Truck}>
          <div className="booking-info-grid">
            <InfoField label="Registration number">{booking.vehicle?.vehicleNumber || 'Not assigned'}</InfoField>
            <InfoField label="Vehicle model">{booking.vehicle?.vehicleModel}</InfoField>
            <InfoField label="Vehicle category">{titleCase(booking.vehicle?.vehicleType)}</InfoField>
            <InfoField label="Capacity">{booking.vehicle?.loadCapacity?.value === null || booking.vehicle?.loadCapacity?.value === undefined ? 'Not available' : `${booking.vehicle.loadCapacity.value} ${booking.vehicle.loadCapacity.unit || ''}`}</InfoField>
            <InfoField label="RC verification">{titleCase(booking.vehicle?.documents?.registration?.status)}</InfoField>
            <InfoField label="Insurance verification">{titleCase(booking.vehicle?.documents?.insurance?.status)}</InfoField>
          </div>
        </BookingCard>

        <BookingCard title="Fare and payment" icon={Wallet} className="booking-finance-card">
          <div className="booking-fare-highlight">
            <span>Estimated fare</span>
            <strong>{formatMoney(booking.estimatedFare)}</strong>
          </div>
          <div className="booking-fare-highlight booking-fare-final">
            <span>Final fare</span>
            <strong>{formatMoney(booking.finalFare)}</strong>
          </div>
          <div className="booking-info-grid booking-payment-grid">
            <InfoField label="Payment status">{titleCase(booking.paymentStatus)}</InfoField>
            <InfoField label="Payment method">{titleCase(payment?.method || (booking.paymentStatus === 'cash' ? 'cash' : null))}</InfoField>
            <InfoField label="Recorded payment amount">{payment?.amount === null || payment?.amount === undefined ? 'Not available' : formatMoney(payment.amount)}</InfoField>
            <InfoField label="Payment reference">{payment?.transactionId || payment?.orderId}</InfoField>
            <InfoField label="Payment date">{paidDate}</InfoField>
            <InfoField label="Refund status">{payment?.status === 'refunded' ? 'Refunded' : payment?.status ? 'Not refunded' : 'Not available'}</InfoField>
            <InfoField label="Refund amount">{payment?.refundAmount === null || payment?.refundAmount === undefined ? 'Not available' : formatMoney(payment.refundAmount)}</InfoField>
            <InfoField label="Cancellation charges">Not supported by booking data</InfoField>
          </div>
          {payment?.provider && <div className="booking-payment-provider"><CreditCard size={14} /> Provider: {payment.provider}</div>}
        </BookingCard>

        <BookingCard title="Booking activity" icon={Clock3} className="booking-activity-card">
          <div className="booking-info-grid">
            <InfoField label="Assignment status">{titleCase(booking.assignmentStatus)}</InfoField>
            <InfoField label="Driver accepted">{formatTimestamp(booking.acceptedAt)}</InfoField>
            <InfoField label="Trip started">{formatTimestamp(booking.startedAt)}</InfoField>
            <InfoField label="Trip completed">{formatTimestamp(booking.completedAt)}</InfoField>
            <InfoField label="Cancelled at">{formatTimestamp(booking.cancelledAt)}</InfoField>
            <InfoField label="Cancelled by">{cancelledEvent?.actor?.name || cancelledEvent?.actorRole}</InfoField>
            <InfoField label="Cancellation reason" wide>{booking.cancellationReason}</InfoField>
            <InfoField label="Driver rejection reason" wide>{booking.rejectedReason || rejectedEvent?.reason}</InfoField>
            <InfoField label="Customer instructions" wide>{booking.customerNote}</InfoField>
            <InfoField label="Last updated">{formatTimestamp(booking.updatedAt)}</InfoField>
          </div>
          {booking.assignmentHistory?.length > 0 && (
            <div className="booking-history-list">
              <h3>Recorded booking history</h3>
              {booking.assignmentHistory.map((entry, index) => (
                <div className="booking-history-item" key={`${entry.action}-${entry.occurredAt || index}`}>
                  <span className="booking-history-marker" />
                  <div>
                    <strong>{titleCase(entry.action)}</strong>
                    <span>{entry.actor?.name || titleCase(entry.actorRole)} · {formatTimestamp(entry.occurredAt)}</span>
                    {entry.reason && <p>{entry.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </BookingCard>
      </div>
      <div className="booking-timezone-note"><CalendarDays size={14} /> Event timestamps are converted from stored instants to your browser time zone ({browserTimeZone}). Scheduled pickup date and time are displayed separately as submitted.</div>
    </main>
  );
}
