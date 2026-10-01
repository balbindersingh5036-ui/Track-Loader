import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Customers() {
  return (
    <ApiListPage
      title="Customers"
      endpoint="/admin/customers"
      collection="customers"
      searchParam="search"
      rowKey="id"
      detailPath={(item) => `/customers/${item.id}`}
      columns={[
        { label: 'Name', path: 'name' },
        { label: 'Email', path: 'email' },
        { label: 'Phone', path: 'phone' },
        { label: 'Status', render: (item) => item.isActive ? 'Active' : 'Inactive' }
      ]}
      actions={[{
        label: 'Toggle status',
        run: (item) => api.patch(`/admin/customers/${item.id}/status`, { isActive: !item.isActive })
      }]}
    />
  );
}