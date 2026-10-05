import axios from 'axios';
import { getToken, removeToken } from '../utils/authStorage';

const baseURL = process.env.EXPO_PUBLIC_API_URL || "https://track-loader.onrender.com/api";

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let onAuthenticationExpired;
export const setAuthenticationExpiredHandler = (handler) => {
  onAuthenticationExpired = handler;
};

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      await removeToken();
      onAuthenticationExpired?.();
    }
    return Promise.reject(error);
  }
);

export default api;