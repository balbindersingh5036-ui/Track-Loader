import api from './api';

export const systemSettingService = {
  getPublicConfig: () => api.get('/config/public'),
  getAdminSettings: (params) => api.get('/admin/settings', { params }),
  getSetting: (key) => api.get(`/admin/settings/${encodeURIComponent(key)}`),
  updateSetting: (key, data) => api.put(`/admin/settings/${encodeURIComponent(key)}`, data),
  createSetting: (data) => api.post('/admin/settings', data),
  deleteSetting: (key) => api.delete(`/admin/settings/${encodeURIComponent(key)}`),
  updateStatus: (key, isActive) => api.patch(`/admin/settings/${encodeURIComponent(key)}/status`, { isActive })
};

export default systemSettingService;
