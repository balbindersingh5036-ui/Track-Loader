import api from './api';

export const vehicleService = {
  getVehicles: () => api.get('/driver/vehicles'),
  addVehicle: (data) => api.post('/driver/vehicles', data),
  updateVehicle: (id, data) => api.put(`/driver/vehicles/${id}`, data),
  updateStatus: (id, statusData) => api.patch(`/driver/vehicles/${id}/status`, statusData)
};

export default vehicleService;