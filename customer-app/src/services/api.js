import axios from "axios";
import { getToken, removeToken } from "../utils/authStorage";

const baseURL = process.env.EXPO_PUBLIC_API_URL;
if (!baseURL) {
  throw new Error("EXPO_PUBLIC_API_URL must be configured for the customer app.");
}

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
  headers: { "Content-Type": "application/json" },
  timeout: 15000
});

let onAuthenticationExpired;
export const setAuthenticationExpiredHandler = (handler) => {
  onAuthenticationExpired = handler;
};

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

export const getApiBaseUrl = () => baseURL.replace(/\/+$/, "");
export default api;
