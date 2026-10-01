import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Complaints() {
  const responseToComplaint = async (item) => {
    const response = window.prompt('Enter an admin response');
    if (response?.trim()) await api.patch(`/admin/complaints/${item._id}/response`, { response });
  };
  return (
    <ApiListPage
      title="Complaints"
      endpoint="/admin/complaints"
      collection="complaints"
      searchParam="search"
      detailPath={(item) => `/complaints/${item._id}`}
      columns={[
        { label: 'ID', render: (item) => String(item._id).slice(-6) },
        { label: 'Customer', path: 'raisedBy.name' },
        { label: 'Subject', path: 'subject' },
        { label: 'Status', path: 'status' }
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