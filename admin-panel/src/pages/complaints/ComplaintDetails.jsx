import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function ComplaintDetails() {
  return (
    <ApiDetailPage
      title="Complaint"
      endpoint="/admin/complaints"
      resource="complaint"
      fields={[
        { label: 'Subject', path: 'subject' },
        { label: 'Status', path: 'status' },
        { label: 'Customer', render: (item) => item.raisedBy?.name || item.raisedBy?.phone || '—' },
        { label: 'Booking', render: (item) => item.booking?.bookingId || '—' },
        { label: 'Description', path: 'description' },
        { label: 'Admin response', path: 'adminResponse' },
        { label: 'Submitted', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—' }
      ]}
    />
  );
}
