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
  const explicitAuthorization = config.headers?.Authorization || config.headers?.authorization;
  if (token && !explicitAuthorization) {
    config.headers.Authorization = "Bearer " + token;
  }

  // If payload is FormData, do not force application/json
  if (
    config.data instanceof FormData ||
    (config.data && typeof config.data.append === "function")
  ) {
    if (typeof window !== "undefined") {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "multipart/form-data";
    }
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