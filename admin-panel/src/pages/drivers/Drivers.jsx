import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Drivers() {
  return (
    <ApiListPage
      title="Drivers"
      endpoint="/admin/drivers"
      collection="drivers"
      searchParam="search"
      rowKey="id"
      detailPath={(item) => `/drivers/${item.id}`}
      columns={[
        { label: 'Name', path: 'name' },
        { label: 'Phone', path: 'phone' },
        { label: 'Online', render: (item) => item.isOnline ? 'Online' : 'Offline' },
        { label: 'Approval', path: 'approvalStatus' },
        { label: 'Account', render: (item) => item.isActive ? 'Active' : 'Inactive' }
      ]}
      actions={[
        ...['approve', 'reject', 'suspend'].map((status) => ({
          label: status[0].toUpperCase() + status.slice(1),
          disabled: (item) => item.approvalStatus === status,
          run: (item) => api.patch(`/admin/drivers/${item.id}/${status}`)
        })),
        {
          label: 'Toggle account',
          run: (item) => api.patch(`/admin/drivers/${item.id}/status`, { isActive: !item.isActive })
        }
      ]}
    />
  );
}