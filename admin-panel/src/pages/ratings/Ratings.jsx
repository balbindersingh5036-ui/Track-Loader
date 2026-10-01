import ApiListPage from '../../components/common/ApiListPage';

export default function Ratings() {
  return (
    <ApiListPage
      title="Ratings"
      endpoint="/admin/ratings"
      collection="ratings"
      detailPath={(item) => `/ratings/${item._id}`}
      columns={[
        { label: 'Rating', render: (item) => `${item.rating} / 5` },
        { label: 'Customer', path: 'customer.name' },
        { label: 'Driver', path: 'driver.fullName' },
        { label: 'Feedback', path: 'feedback' },
        { label: 'Submitted', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—' }
      ]}
    />
  );
}
