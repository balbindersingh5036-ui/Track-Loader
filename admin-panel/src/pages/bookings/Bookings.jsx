import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Bookings() {
  const assignDriver = async (booking) => {
    const response = await api.get('/admin/drivers', { params: { approvalStatus: 'approved', limit: 100 } });
    const drivers = response.data?.data?.drivers || [];
    if (!drivers.length) throw new Error('No approved drivers are available.');
    const choice = window.prompt(
      `Choose a driver number:\n${drivers.map((driver, index) => `${index + 1}. ${driver.name} (${driver.phone})`).join('\n')}`
    );
    if (choice === null) return;
    const index = Number(choice) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= drivers.length) throw new Error('Choose a valid driver number.');
    await api.patch(`/admin/bookings/${booking._id}/assign-driver`, { driverId: drivers[index].id });
  };

  return (
    <ApiListPage
      title="Bookings"
      endpoint="/admin/bookings"
      collection="bookings"
      searchParam="bookingId"
      detailPath={(item) => `/bookings/${item._id}`}
      columns={[
        { label: 'Booking', path: 'bookingId' },
        { label: 'Customer', render: (item) => item.customer?.name || '—' },
        { label: 'Driver', render: (item) => item.driver?.fullName || 'Unassigned' },
        { label: 'Status', path: 'bookingStatus' },
        { label: 'Fare', render: (item) => `₹${item.finalFare || item.estimatedFare || 0}` }
      ]}
      actions={[
        {
          label: 'Assign driver',
          disabled: (item) => ['completed', 'cancelled'].includes(item.bookingStatus),
          run: assignDriver
        },
        ...['accepted', 'cancelled'].map((status) => ({
          label: status[0].toUpperCase() + status.slice(1),
          disabled: (item) => ['completed', 'cancelled'].includes(item.bookingStatus) || item.bookingStatus === status,
          run: (item) => api.patch(`/admin/bookings/${item._id}/status`, { status })
        }))
      ]}
    />
  );
}