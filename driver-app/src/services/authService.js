import api from './api';

export const authService = {
  login: (credentials) => api.post('/auth/driver/login', credentials),
  getMe: () => api.get('/auth/me')
};

export default authService;