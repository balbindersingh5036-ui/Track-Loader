import api from './api';

export const agencyService = {
  // Super Admin Endpoints
  getAdminAgencies: (params) => api.get('/admin/agencies', { params }),
  getAdminAgencyById: (id) => api.get(`/admin/agencies/${id}`),
  approveAgency: (id) => api.patch(`/admin/agencies/${id}/approve`),
  rejectAgency: (id, reason) => api.patch(`/admin/agencies/${id}/reject`, { reason }),
  suspendAgency: (id, reason) => api.patch(`/admin/agencies/${id}/suspend`, { reason }),

  // Super Admin Driver Approval
  approveDriver: (id) => api.patch(`/admin/drivers/${id}/approve`),
  rejectDriver: (id, reason) => api.patch(`/admin/drivers/${id}/reject`, { reason }),
  suspendDriver: (id, reason) => api.patch(`/admin/drivers/${id}/suspend`, { reason }),
  getAdminDriverById: (id) => api.get(`/admin/drivers/${id}`),

  // Agency Owner Endpoints
  registerAgency: (data) => api.post('/agency/register', data),
  getMyAgency: () => api.get('/agency/profile'),
  updateMyAgency: (data) => api.put('/agency/profile', data),
  getAgencyDrivers: () => api.get('/agency/drivers'),
  createAgencyDriver: (data) => api.post('/agency/drivers', data),
  updateDriverDocuments: (id, documents) => api.patch(`/agency/drivers/${id}/documents`, { documents }),
  getAgencyVehicles: () => api.get('/agency/vehicles'),
  createAgencyVehicle: (data) => api.post('/agency/vehicles', data),
  updateAgencyVehicle: (id, data) => api.put(`/agency/vehicles/${id}`, data),
  assignVehicleDriver: (id, driverId) => api.patch(`/agency/vehicles/${id}/driver`, { driverId }),
  getAgencyBookings: () => api.get('/agency/bookings'),
  uploadFile: (file, purpose = 'document') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('purpose', purpose);
    return api.post('/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Authenticated KYC Document View URLs (Short-lived signed access)
  getAgencyDocumentView: (agencyId, docType) => api.get(`/documents/agency/${agencyId}/${docType}`),
  getDriverDocumentView: (driverId, docType) => api.get(`/documents/driver/${driverId}/${docType}`)
};

export default agencyService;
