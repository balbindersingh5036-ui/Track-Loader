import api from './api';

export const vehicleService = {
  getVehicles: (params) => api.get('/admin/vehicles', { params }),
  getVehicle: (vehicleId) => api.get(`/admin/vehicles/${encodeURIComponent(vehicleId)}`),
  updateVehicle: (vehicleId, data) =>
    api.put(`/admin/vehicles/${encodeURIComponent(vehicleId)}`, data),
  updateVehicle: (vehicleId, data) =>
    api.put(`/admin/vehicles/${encodeURIComponent(vehicleId)}`, data),
  reviewDocument: (vehicleId, docType, action, reason) => api.patch(
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/documents/${docType}/${action}`,
    action === 'reject' ? { reason } : {}
  ),
  getDocumentView: (vehicleId, docType) =>
    api.get(`/documents/vehicle/${encodeURIComponent(vehicleId)}/${docType}`),
  updateVehicleStatus: (vehicleId, isActive) =>
    api.patch(`/admin/vehicles/${encodeURIComponent(vehicleId)}/status`, { isActive })
};
export default vehicleService;