import ApiDetailPage from '../../components/common/ApiDetailPage';

const bookingStatusLabel = (booking) => {
  if (booking.bookingStatus === 'cancelled') return 'Cancelled';
  if (booking.bookingStatus === 'completed') return 'Completed';
  if (booking.bookingStatus === 'in-progress') return 'In Progress';
  if (booking.bookingStatus === 'accepted') return 'Driver Accepted';
  if (booking.bookingStatus === 'rejected' || booking.assignmentStatus === 'rejected') return 'Driver Rejected';
  if (booking.assignmentStatus === 'pending_acceptance') return 'Awaiting Driver Acceptance';
  if (booking.bookingStatus === 'pending' && booking.driver) return 'Awaiting Driver Acceptance';
  return 'Pending Agency Assignment';
};

export default function BookingDetails() {
  return (
    <ApiDetailPage
      title="Booking"
      endpoint="/admin/bookings"
      resource="booking"
      fields={[
        { label: 'Booking ID', path: 'bookingId' },
        { label: 'Status', render: bookingStatusLabel },
        { label: 'Customer', render: (item) => item.customer?.name || item.customer?.phone || '—' },
        { label: 'Agency', render: (item) => item.agency?.agencyName || '—' },
        { label: 'Driver', render: (item) => item.driver?.fullName || 'Unassigned' },
        { label: 'Vehicle', render: (item) => item.vehicle?.vehicleNumber || '—' },
        { label: 'Pickup', path: 'pickup.address' },
        { label: 'Drop-off', path: 'drop.address' },
        { label: 'Goods', path: 'goods' },
        { label: 'Weight', render: (item) => item.weight ? `${item.weight.value} ${item.weight.unit}` : '—' },
        { label: 'Estimated fare', render: (item) => `₹${item.estimatedFare ?? 0}` },
        { label: 'Final fare', render: (item) => item.finalFare === undefined ? '—' : `₹${item.finalFare}` },
        { label: 'Payment status', path: 'paymentStatus' },
        { label: 'Scheduled pickup', render: (item) => `${item.preferredPickupDate ? new Date(item.preferredPickupDate).toLocaleString() : '—'} ${item.preferredPickupTime || ''}` },
        { label: 'Assignment status', path: 'assignmentStatus' },
        { label: 'Driver accepted at', render: (item) => item.acceptedAt ? new Date(item.acceptedAt).toLocaleString() : '—' },
        { label: 'Trip started at', render: (item) => item.startedAt ? new Date(item.startedAt).toLocaleString() : '—' },
        { label: 'Trip completed at', render: (item) => item.completedAt ? new Date(item.completedAt).toLocaleString() : '—' },
        { label: 'Cancelled at', render: (item) => item.cancelledAt ? new Date(item.cancelledAt).toLocaleString() : '—' },
        { label: 'Cancellation reason', path: 'cancellationReason' },
        { label: 'Driver rejection reason', path: 'rejectedReason' },
        { label: 'Customer instructions', path: 'customerNote' },
        {
          label: 'Lifecycle history',
          render: (item) => (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {(item.assignmentHistory || []).map((entry, index) => (
                <li key={`${entry.action}-${entry.occurredAt || index}`}>
                  {entry.action} · {entry.actor?.name || entry.actorRole || 'system'} · {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : '—'}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </li>
              ))}
            </ol>
          )
        }
      ]}
    />
  );
}
