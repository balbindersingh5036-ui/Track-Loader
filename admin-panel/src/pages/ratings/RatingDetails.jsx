import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function RatingDetails() {
  return (
    <ApiDetailPage
      title="Rating"
      endpoint="/admin/ratings"
      resource="rating"
      fields={[
        { label: 'Score', render: (item) => `${item.rating} / 5` },
        { label: 'Customer', render: (item) => item.customer?.name || item.customer?.phone || '—' },
        { label: 'Driver', render: (item) => item.driver?.fullName || item.driver?.phone || '—' },
        { label: 'Feedback', path: 'feedback' },
        { label: 'Submitted', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—' }
      ]}
    />
  );
}
