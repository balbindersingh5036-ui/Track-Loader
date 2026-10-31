import { Platform } from 'react-native';
import api from './api';
import { loadAllAgencyBookingPages } from '../utils/agencyBookings.mjs';

const AGENCY_BOOKING_PAGE_SIZE = 100;

const appendMobileFile = (formData, field, file) => {
  if (!file) return;
  if (Platform.OS === 'web') {
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      formData.append(field, file, file.name || 'file');
      return;
    }
    if (file.file && typeof Blob !== 'undefined' && file.file instanceof Blob) {
      formData.append(field, file.file, file.name || file.file.name || 'file');
      return;
    }
  }
  const extension = file.name?.split('.').pop()?.toLowerCase();
  const extensionMimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf'
  };
  formData.append(field, {
    uri: file.uri,
    name: file.name || 'document',
    type: file.mimeType || extensionMimeTypes[extension] || 'application/octet-stream'
  });
};

const multipartConfig = (config = {}) => {
  const headers = { ...config.headers };
  // On web, remove manual Content-Type header so browser/Axios sets boundary automatically
  if (Platform.OS === 'web' || typeof window !== 'undefined') {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
  return {
    ...config,
    onUploadProgress: config.onUploadProgress
      ? (event) => {
        if (event.total) config.onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
      : undefined,
    headers,
    timeout: 120000
  };
};

const vehicleMultipartForm = (data, photos = [], retainedPhotos) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  if (retainedPhotos !== undefined) {
    formData.append('existingPhotos', JSON.stringify(retainedPhotos));
  }
  photos.forEach((file) => appendMobileFile(formData, 'photos', file));
  return formData;
};

export const agencyService = {
  registerAgency: (data, documents, token) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value ?? ''));
    Object.entries(documents || {}).forEach(([key, file]) => appendMobileFile(formData, key, file));
    return api.post('/agency/register', formData, multipartConfig({
      headers: { Authorization: `Bearer ${token}` }
    }));
  },
  getMyAgency: () => api.get('/agency/profile'),
  updateMyAgency: (data) => api.put('/agency/profile', data),
  getAgencyStats: () => api.get('/agency/stats'),
  getAgencyDrivers: () => api.get('/agency/drivers'),
  getDriverDocument: (driverId, docType) => api.get(`/documents/driver/${driverId}/${docType}`),
  getAgencyDriverRequests: () => api.get('/agency/driver-requests'),
  acceptAgencyDriverRequest: (driverId) => api.patch(`/agency/driver-requests/${driverId}/accept`),
  rejectAgencyDriverRequest: (driverId, reason) =>
    api.patch(`/agency/driver-requests/${driverId}/reject`, { reason }),
  createAgencyDriver: (details) => api.post('/agency/drivers', details),
  getAgencyVehicles: () => api.get('/agency/vehicles'),
  createAgencyVehicle: (data, photos = [], onUploadProgress) =>
    api.post('/agency/vehicles', vehicleMultipartForm(data, photos), multipartConfig({ onUploadProgress })),
  updateAgencyVehicle: (vehicleId, data, photos, retainedPhotos, onUploadProgress) =>
    api.put(
      `/agency/vehicles/${vehicleId}`,
      vehicleMultipartForm(data, photos, retainedPhotos),
      multipartConfig({ onUploadProgress })
    ),
  assignVehicleDriver: (vehicleId, driverId) =>
    api.patch(`/agency/vehicles/${vehicleId}/driver`, { driverId }),
  unassignVehicleDriver: (vehicleId) =>
    api.patch(`/agency/vehicles/${vehicleId}/driver`, { unassign: true }),
  uploadAgencyDocument: (agencyId, docType, file) => {
    const formData = new FormData();
    appendMobileFile(formData, 'document', file);
    return api.post(`/documents/agency/${agencyId}/${docType}`, formData, multipartConfig());
  },
  uploadVehicleDocument: (vehicleId, docType, file) => {
    const formData = new FormData();
    appendMobileFile(formData, 'document', file);
    return api.post(`/documents/vehicle/${vehicleId}/${docType}`, formData, multipartConfig());
  },
  getAgencyBookings: () => loadAllAgencyBookingPages((page, limit) =>
    api.get('/agency/bookings', { params: { page, limit } }),
  AGENCY_BOOKING_PAGE_SIZE),
  assignAgencyBooking: (bookingId, driverId, vehicleId) =>
    api.patch(`/agency/bookings/${bookingId}/assign`, { driverId, vehicleId })
};

export default agencyService;
