import React, { useState } from 'react';
import ApiListPage from '../../components/common/ApiListPage';

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

export default function Bookings() {
  const [activeFilter, setActiveFilter] = useState({ value: '' });
  return (
    <ApiListPage
      title="Bookings"
      endpoint="/admin/bookings"
      collection="bookings"
      searchParam="bookingId"
      detailPath={(item) => `/bookings/${item._id}`}
      filters={[
        { label: 'All', value: '' },
        { label: 'Pending Agency Assignment', value: 'unassigned', param: 'assignmentStatus' },
        { label: 'Awaiting Driver Acceptance', value: 'pending_acceptance', param: 'assignmentStatus' },
        { label: 'Driver Rejected', value: 'rejected', param: 'assignmentStatus' },
        { label: 'Driver Accepted', value: 'accepted', param: 'bookingStatus' },
        { label: 'In Progress', value: 'in-progress', param: 'bookingStatus' },
        { label: 'Completed', value: 'completed', param: 'bookingStatus' },
        { label: 'Cancelled', value: 'cancelled', param: 'bookingStatus' }
      ]}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      columns={[
        { label: 'Booking Reference', path: 'bookingId' },
        { label: 'Customer', render: (item) => item.customer?.name || '—' },
        { label: 'Agency', render: (item) => item.agency?.agencyName || '—' },
        { label: 'Assigned Driver', render: (item) => item.driver?.fullName || 'Unassigned' },
        { label: 'Status', render: bookingStatusLabel },
        { label: 'Fare', render: (item) => `₹${item.finalFare || item.estimatedFare || 0}` }
      ]}
    />
  );
}
