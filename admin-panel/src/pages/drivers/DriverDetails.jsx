import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function DriverDetails() {
  return (
    <ApiDetailPage
      title="Driver"
      endpoint="/admin/drivers"
      resource="driver"
      fields={[
        { label: 'Name', path: 'name' },
        { label: 'Email', path: 'email' },
        { label: 'Phone', path: 'phone' },
        { label: 'Approval', path: 'approvalStatus' },
        { label: 'Account status', render: (item) => item.isActive ? 'Active' : 'Inactive' },
        { label: 'Online', render: (item) => item.isOnline ? 'Online' : 'Offline' },
        { label: 'Rating', path: 'rating' },
        { label: 'Completed trips', path: 'totalTrips' },
        { label: 'Vehicles', render: (item) => (item.vehicles || []).map((vehicle) => `${vehicle.vehicleNumber} (${vehicle.vehicleModel})`).join(', ') || '—' }
      ]}
    />
  );
}
