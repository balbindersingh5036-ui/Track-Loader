import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function CustomerDetails() {
  return (
    <ApiDetailPage
      title="Customer"
      endpoint="/admin/customers"
      resource="customer"
      fields={[
        { label: 'Name', path: 'name' },
        { label: 'Email', path: 'email' },
        { label: 'Phone', path: 'phone' },
        { label: 'Account status', render: (item) => item.isActive ? 'Active' : 'Inactive' },
        { label: 'Registered', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString() : '—' },
        { label: 'Last login', render: (item) => item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : '—' }
      ]}
    />
  );
}
