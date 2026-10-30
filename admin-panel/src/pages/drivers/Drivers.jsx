import React, { useState } from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Drivers() {
  const [activeFilter, setActiveFilter] = useState({ label: 'All Drivers', value: '' });

  return (
    <ApiListPage
      title="Drivers"
      endpoint="/admin/drivers"
      collection="drivers"
      searchParam="search"
      rowKey="id"
      detailPath={(item) => `/drivers/${item.id}`}
      filters={[
        { label: 'All Drivers', value: '' },
        { label: 'Pending Agency Approval', value: 'pending_agency', param: 'filter' },
        { label: 'Agency Accepted, Pending Super Admin', value: 'agency_accepted_pending_super_admin', param: 'filter' },
        { label: 'Pending KYC Documents', value: 'pending_kyc', param: 'filter' },
        { label: 'Pending Final Driver Approval', value: 'pending_final_approval', param: 'filter' },
        { label: 'Fully Approved', value: 'fully_approved', param: 'filter' },
        { label: 'Rejected', value: 'rejected', param: 'filter' },
        { label: 'Suspended', value: 'suspended', param: 'filter' }
      ]}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      columns={[
        { label: 'Name', path: 'name' },
        { label: 'Phone', path: 'phone' },
        {
          label: 'Agency',
          render: (item) => item.agency?.agencyName
            ? `${item.agency.agencyName} · ${item.agency.id}`
            : 'Independent'
        },
        {
          label: 'Agency Association',
          render: (item) => {
            if (!item.agency) return <span style={{ color: 'var(--text-secondary)' }}>N/A (Independent)</span>;
            const status = item.agencyAssociation?.status || 'pending';
            const color = status === 'approved' ? '#10b981' : status === 'rejected' ? '#ef4444' : '#f59e0b';
            const label = status === 'approved' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending Agency';
            return <span style={{ color, fontWeight: 600 }}>{label}</span>;
          }
        },
        { label: 'Registered', render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—' },
        { label: 'Online', render: (item) => item.isOnline ? 'Online' : 'Offline' },
        { label: 'Approval', path: 'approvalStatus' },
        { label: 'Driving Licence', render: (item) => item.documents?.drivingLicense?.status || 'not uploaded' },
        { label: 'Identity Proof', render: (item) => item.documents?.idProof?.status || 'not uploaded' },
        { label: 'Account', render: (item) => item.isActive ? 'Active' : 'Inactive' }
      ]}
      actions={[
        ...['approve', 'reject', 'suspend'].map((status) => ({
          label: status[0].toUpperCase() + status.slice(1),
          disabled: (item) => !item.canApproveDriver || item.approvalStatus === status,
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
