import api from './api';

export const fareService = {
  getCategories: () => api.get('/admin/fares/categories'),
  getFares: (params) => api.get('/admin/fares', { params }),
  getFareById: (id) => api.get(`/admin/fares/${encodeURIComponent(id)}`),
  createFare: (data) => api.post('/admin/fares', data),
  updateFare: (id, data) => api.put(`/admin/fares/${encodeURIComponent(id)}`, data),
  toggleFareStatus: (id) => api.patch(`/admin/fares/${encodeURIComponent(id)}/status`),
  deleteFare: (id) => api.delete(`/admin/fares/${encodeURIComponent(id)}`)
};

export default fareService;
