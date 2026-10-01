import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Vehicles() {
  return (
    <ApiListPage
      title="Vehicles"
      endpoint="/admin/vehicles"
      collection="vehicles"
      searchParam="search"
      detailPath={(item) => `/vehicles/${item._id}`}
      columns={[
        { label: 'Number', path: 'vehicleNumber' },
        { label: 'Model', path: 'vehicleModel' },
        { label: 'Type', path: 'vehicleType' },
        { label: 'Driver', render: (item) => item.driver?.name || item.driver?.fullName || '—' },
        { label: 'Status', render: (item) => !item.isActive ? 'Inactive' : item.isAvailable ? 'Available' : 'Unavailable' }
      ]}
      actions={[{
        label: 'Toggle active',
        run: (item) => api.patch(`/admin/vehicles/${item._id}/status`, { isActive: !item.isActive })
      }]}
    />
  );
}