import api from './api';

export const driverService = {
  getProfile: () => api.get('/driver/profile'),
  updateStatus: (isOnline) => api.patch('/driver/status', { isOnline })
};

export default driverService;