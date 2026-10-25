import api from './api';

export const driverService = {
  getProfile: () => api.get('/driver/profile'),
  updateStatus: (isOnline) => api.patch('/driver/status', { isOnline }),
  getVehicles: () => api.get('/driver/vehicles'),
  getDocument: (driverId, docType) => api.get(`/documents/driver/${driverId}/${docType}`),
  getVehicleDocument: (vehicleId, docType) => api.get(`/documents/vehicle/${vehicleId}/${docType}`),
  uploadDocument: (driverId, docType, data, onUploadProgress) =>
    api.post(`/documents/driver/${driverId}/${docType}`, data, {
      timeout: 120000,
      onUploadProgress
    }),
  uploadVehicleDocument: (vehicleId, docType, data, onUploadProgress) =>
    api.post(`/documents/vehicle/${vehicleId}/${docType}`, data, {
      timeout: 120000,
      onUploadProgress
    })
};

export default driverService;