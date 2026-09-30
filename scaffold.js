const fs = require('fs');
const path = require('path');

const generateScaffold = (basePath, type) => {
  const dirs = [
    'src/components',
    'src/screens',
    'src/pages',
    'src/navigation',
    'src/routes',
    'src/services',
    'src/store',
    'src/constants',
    'src/utils',
    'src/theme',
    'src/styles'
  ];

  dirs.forEach(dir => {
    fs.mkdirSync(path.join(basePath, dir), { recursive: true });
  });

  const apiJs = `
import axios from 'axios';
import { getToken, removeToken } from '../utils/authStorage';

const baseURL = process.env.EXPO_PUBLIC_API_URL || (typeof import !== "undefined" && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

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
    if (error.response?.status === 401) {
      await removeToken();
    }
    return Promise.reject(error);
  }
);

export default api;
`;
  fs.writeFileSync(path.join(basePath, 'src/services/api.js'), apiJs.trim());

  const authStorageJs = `
export const saveToken = async (token) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', token);
    }
  } catch (e) {}
};

export const getToken = async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const removeToken = async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
  } catch (e) {}
};
`;
  fs.writeFileSync(path.join(basePath, 'src/utils/authStorage.js'), authStorageJs.trim());

  const services = ['auth', 'user', 'vehicle', 'booking', 'notification', 'payment', 'driver', 'customer', 'report', 'systemSetting'];
  services.forEach(svc => {
    const content = `
import api from './api';

export const ` + svc + `Service = {
  // Add API wrappers here
};
export default ` + svc + `Service;
    `;
    fs.writeFileSync(path.join(basePath, 'src/services/' + svc + 'Service.js'), content.trim());
  });

  let screens = [];
  if (type === 'customer') {
    screens = ['Splash', 'Login', 'Register', 'Home', 'VehicleList', 'VehicleDetails', 'MyBookings', 'BookingDetails', 'Notifications', 'Profile', 'EditProfile'];
  } else if (type === 'driver') {
    screens = ['Splash', 'Login', 'Dashboard', 'BookingRequests', 'RequestDetails', 'MyBookings', 'BookingDetails', 'Vehicle', 'Profile', 'Notifications', 'Earnings'];
  } else if (type === 'admin') {
    screens = ['Login', 'Dashboard', 'Customers', 'CustomerDetails', 'Drivers', 'DriverDetails', 'Vehicles', 'Bookings', 'Payments', 'Reports', 'Settings', 'Notifications'];
  }

  const screenDir = type === 'admin' ? 'src/pages' : 'src/screens';
  screens.forEach(screen => {
    const ext = type === 'admin' ? 'jsx' : 'js';
    const content = `
import React from 'react';

const ` + screen + ` = () => {
  return (
    <div>
      <h1>` + screen + ` Placeholder</h1>
    </div>
  );
};

export default ` + screen + `;
    `;
    fs.writeFileSync(path.join(basePath, screenDir + '/' + screen + '.' + ext), content.trim());
  });
};

['customer-app', 'driver-app', 'admin-panel'].forEach(app => {
  let type = 'admin';
  if (app.includes('customer')) type = 'customer';
  if (app.includes('driver')) type = 'driver';
  
  generateScaffold(path.join('E:/LoadBalbin', app), type);
  
  let envContent = '';
  if (type === 'admin') {
    envContent = 'VITE_API_URL=http://localhost:5000/api\\n';
  } else {
    envContent = 'EXPO_PUBLIC_API_URL=http://localhost:5000/api\\n';
  }
  fs.writeFileSync(path.join('E:/LoadBalbin', app, '.env'), envContent);
});

console.log("Scaffolding complete");
