import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Complaints() {
  const responseToComplaint = async (item) => {
    const response = window.prompt('Enter an admin response:');
    if (response?.trim()) {
      await api.patch(`/admin/complaints/${item._id}/response`, { response: response.trim() });
    }
  };

  return (
    <ApiListPage
      title="Complaints & Support Tickets"
      endpoint="/admin/complaints"
      collection="complaints"
      searchParam="search"
      detailPath={(item) => `/complaints/${item._id}`}
      columns={[
        {
          label: 'Ticket ID',
          render: (item) => (
            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {item.ticketId || ('TKT-' + String(item._id).slice(-5).toUpperCase())}
            </span>
          )
        },
        {
          label: 'Customer',
          render: (item) => item.raisedBy?.name || item.raisedBy?.phone || item.raisedBy?.email || '—'
        },
        {
          label: 'Booking Number',
          render: (item) => {
            const bookingNumber = item.bookingReference || item.booking?.bookingId;
            if (bookingNumber) {
              return (
                <span style={{ fontWeight: 600, color: 'var(--primary, #2563eb)' }}>
                  {bookingNumber}
                </span>
              );
            }
            return (
              <span style={{ color: 'var(--text-muted, #888)', fontStyle: 'italic' }}>
                Not linked to a booking
              </span>
            );
          }
        },
        { label: 'Subject', path: 'subject' },
        {
          label: 'Status',
          render: (item) => (
            <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 12 }}>
              {item.status || 'open'}
            </span>
          )
        },
        {
          label: 'Creation Date',
          render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'
        }
      ]}
      actions={[
        {
          label: 'Move to review',
          disabled: (item) => item.status !== 'open',
          run: (item) => api.patch(`/admin/complaints/${item._id}/status`, { status: 'in-review' })
        },
        {
          label: 'Resolve',
          disabled: (item) => !['open', 'in-review'].includes(item.status),
          run: (item) => api.patch(`/admin/complaints/${item._id}/status`, { status: 'resolved' })
        },
        { label: 'Respond', run: responseToComplaint }
      ]}
    />
  );
}
