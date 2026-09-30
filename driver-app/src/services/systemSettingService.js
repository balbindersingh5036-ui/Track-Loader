import api from './api';

export const systemSettingService = {
  getPublicConfig: () => api.get('/config/public')
};

export default systemSettingService;