import React from 'react';
import { Link } from 'react-router-dom';
import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function ComplaintDetails() {
  return (
    <ApiDetailPage
      title="Support Ticket"
      endpoint="/admin/complaints"
      resource="complaint"
      fields={[
        {
          label: 'Ticket ID',
          render: (item) => (
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {item.ticketId || ('TKT-' + String(item._id).slice(-5).toUpperCase())}
            </span>
          )
        },
        { label: 'Subject', path: 'subject' },
        {
          label: 'Status',
          render: (item) => (
            <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
              {item.status || 'open'}
            </span>
          )
        },
        {
          label: 'Customer Information',
          render: (item) => {
            const parts = [
              item.raisedBy?.name,
              item.raisedBy?.phone ? `Phone: ${item.raisedBy.phone}` : null,
              item.raisedBy?.email ? `Email: ${item.raisedBy.email}` : null
            ].filter(Boolean);
            return parts.length ? parts.join(' | ') : '—';
          }
        },
        {
          label: 'Associated Booking Number',
          render: (item) => {
            const bookingRef = item.bookingReference || item.booking?.bookingId;
            const bookingMongoId = item.booking?._id || (typeof item.booking === 'string' ? item.booking : null);
            if (bookingRef && bookingMongoId) {
              return (
                <Link
                  to={`/bookings/${bookingMongoId}`}
                  style={{
                    fontWeight: 700,
                    color: 'var(--primary, #2563eb)',
                    textDecoration: 'underline'
                  }}
                  title="Open booking details"
                >
                  {bookingRef} ↗ (View Booking Details)
                </Link>
              );
            }
            if (bookingRef) {
              return <span style={{ fontWeight: 700 }}>{bookingRef}</span>;
            }
            return (
              <span style={{ color: 'var(--text-muted, #888)', fontStyle: 'italic' }}>
                Not linked to a booking
              </span>
            );
          }
        },
        {
          label: 'Booking Status',
          render: (item) => item.booking?.bookingStatus ? (
            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>
              {item.booking.bookingStatus}
            </span>
          ) : '—'
        },
        {
          label: 'Booking Date',
          render: (item) => item.booking?.createdAt ? new Date(item.booking.createdAt).toLocaleString() : '—'
        },
        {
          label: 'Service / Vehicle',
          render: (item) => {
            if (!item.booking) return '—';
            const type = item.booking.vehicleType || '';
            const name = item.booking.vehicleName || '';
            if (type && name) return `${type} — ${name}`;
            return type || name || '—';
          }
        },
        {
          label: 'Complaint Description',
          render: (item) => (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, maxWidth: 650 }}>
              {item.description}
            </div>
          )
        },
        {
          label: 'Support Replies & History',
          render: (item) => item.adminResponse ? (
            <div style={{
              whiteSpace: 'pre-wrap',
              padding: '10px 14px',
              backgroundColor: 'var(--surface-alt, #f1f5f9)',
              borderRadius: 8,
              borderLeft: '4px solid var(--primary, #2563eb)',
              maxWidth: 650
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary, #2563eb)', marginBottom: 4 }}>
                SUPPORT TEAM RESPONSE:
              </div>
              {item.adminResponse}
            </div>
          ) : (
            <span style={{ fontStyle: 'italic', color: 'var(--text-muted, #888)' }}>
              (Awaiting admin/support response)
            </span>
          )
        },
        {
          label: 'Submitted Date',
          render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'
        },
        {
          label: 'Resolved Date',
          render: (item) => item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : '—'
        }
      ]}
    />
  );
}
