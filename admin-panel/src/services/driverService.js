import api from './api';

export const driverService = {
  getAdminDrivers: (params) => api.get('/admin/drivers', { params }),
  getAdminDriverById: (id) => api.get(`/admin/drivers/${id}`),
  approveDriver: (id) => api.patch(`/admin/drivers/${id}/approve`),
  rejectDriver: (id, reason) => api.patch(`/admin/drivers/${id}/reject`, { reason }),
  suspendDriver: (id, reason) => api.patch(`/admin/drivers/${id}/suspend`, { reason }),
  toggleDriverStatus: (id, isActive) => api.patch(`/admin/drivers/${id}/status`, { isActive }),
  reviewDriverDocument: (id, docType, action, reason) =>
    api.patch(`/admin/drivers/${id}/documents/${docType}/${action}`, action === 'reject' ? { reason } : {}),
  getDriverDocumentViewUrl: (driverId, docType) =>
    api.get(`/documents/driver/${driverId}/${docType}`)
};

export default driverService;