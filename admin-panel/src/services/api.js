import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://track-loader.onrender.com/api', // Uses env var or defaults to production
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token && config.url !== '/auth/admin/login') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      window.alert(error.response.data?.message || 'You do not have permission to perform this action.');
    }
    return Promise.reject(error);
  }
);

export default api;