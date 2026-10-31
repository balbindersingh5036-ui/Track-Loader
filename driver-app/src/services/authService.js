import api from './api';

export const authService = {
  login: (credentials) => api.post(
    credentials.role === 'agency' ? '/auth/agency/login' : '/auth/driver/login',
    credentials
  ),
  register: (details) => api.post('/auth/driver/register', details),
  registerCustomer: (details) => api.post('/auth/register', details),
  getVerifiedAgencies: () => api.get('/agency/verified'),
  getMe: () => api.get('/auth/me')
};

export default authService;