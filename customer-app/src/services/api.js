import axios from "axios";
import { getToken, removeToken } from "../utils/authStorage";
import { Platform } from "react-native";

const PROD_API_URL = "https://track-loader.onrender.com/api";

const resolveBaseUrl = () => {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim();

  // In production builds (!__DEV__), never allow localhost or emulator loopback URLs
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    if (
      envUrl &&
      !envUrl.includes("localhost") &&
      !envUrl.includes("127.0.0.1") &&
      !envUrl.includes("10.0.2.2")
    ) {
      return envUrl;
    }
    return PROD_API_URL;
  }

  // In development mode (__DEV__), allow envUrl if set
  if (envUrl) {
    return envUrl;
  }
  return PROD_API_URL;
};

const baseURL = resolveBaseUrl();

const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
  headers: { "Content-Type": "application/json" },
  timeout: 45000 // 45 seconds to accommodate free-tier Render server cold starts
});

let onAuthenticationExpired;
export const setAuthenticationExpiredHandler = (handler) => {
  onAuthenticationExpired = handler;
};

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // If payload is FormData, do not force application/json
  if (
    config.data instanceof FormData ||
    (config.data && typeof config.data.append === "function")
  ) {
    if (Platform.OS === "web") {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "multipart/form-data";
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Safe diagnostic logging without exposing passwords or tokens
    const method = error.config?.method?.toUpperCase() || "UNKNOWN";
    const fullUrl = (error.config?.baseURL ? `${error.config.baseURL.replace(/\/+$/, "")}/${(error.config.url || "").replace(/^\/+/, "")}` : error.config?.url) || "UNKNOWN";
    const status = error.response?.status || error.code || "NO_RESPONSE";
    const msg = error.response?.data?.message || error.message;
    console.warn(`[API Connection] ${method} ${fullUrl} -> ${status}: ${msg}`);

    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      await removeToken();
      onAuthenticationExpired?.();
    }
    return Promise.reject(error);
  }
);

export const getApiBaseUrl = () => baseURL.replace(/\/+$/, "");
export default api;
