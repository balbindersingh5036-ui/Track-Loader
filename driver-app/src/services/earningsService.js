import api from './api';

export const earningsService = {
  getSummary: (params) => api.get('/driver/earnings/summary', { params }),
  getEarnings: (params) => api.get('/driver/earnings', { params })
};
export default earningsService;
