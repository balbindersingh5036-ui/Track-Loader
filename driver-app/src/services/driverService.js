import api from './api';

export const driverService = {
  getProfile: () => api.get('/driver/profile'),
  updateStatus: (isOnline) => api.patch('/driver/status', { isOnline }),
  getVehicles: () => api.get('/driver/vehicles'),
  getDocument: (driverId, docType) => api.get(`/documents/driver/${driverId}/${docType}`)
};

export default driverService;