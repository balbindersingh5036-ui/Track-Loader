import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function BookingDetails() {
  return (
    <ApiDetailPage
      title="Booking"
      endpoint="/admin/bookings"
      resource="booking"
      fields={[
        { label: 'Booking ID', path: 'bookingId' },
        { label: 'Status', path: 'bookingStatus' },
        { label: 'Customer', render: (item) => item.customer?.name || item.customer?.phone || '—' },
        { label: 'Driver', render: (item) => item.driver?.fullName || 'Unassigned' },
        { label: 'Vehicle', render: (item) => item.vehicle?.vehicleNumber || '—' },
        { label: 'Pickup', path: 'pickup.address' },
        { label: 'Drop-off', path: 'drop.address' },
        { label: 'Goods', path: 'goods' },
        { label: 'Weight', render: (item) => item.weight ? `${item.weight.value} ${item.weight.unit}` : '—' },
        { label: 'Estimated fare', render: (item) => `₹${item.estimatedFare ?? 0}` },
        { label: 'Final fare', render: (item) => item.finalFare === undefined ? '—' : `₹${item.finalFare}` },
        { label: 'Payment status', path: 'paymentStatus' }
      ]}
    />
  );
}
