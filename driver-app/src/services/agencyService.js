import api from './api';

const appendMobileFile = (formData, field, file) => {
  if (!file) return;
  if (typeof window !== 'undefined' && file.file) {
    formData.append(field, file.file, file.name);
    return;
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

const multipartConfig = (config = {}) => ({
  ...config,
  headers: {
    ...config.headers,
    'Content-Type': 'multipart/form-data'
  },
  timeout: 120000
});

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
  getAgencyDriverRequests: () => api.get('/agency/driver-requests'),
  acceptAgencyDriverRequest: (driverId) => api.patch(`/agency/driver-requests/${driverId}/accept`),
  rejectAgencyDriverRequest: (driverId, reason) =>
    api.patch(`/agency/driver-requests/${driverId}/reject`, { reason }),
  createAgencyDriver: (details) => api.post('/agency/drivers', details),
  getAgencyVehicles: () => api.get('/agency/vehicles'),
  createAgencyVehicle: (data) => api.post('/agency/vehicles', data),
  updateAgencyVehicle: (vehicleId, data) => api.put(`/agency/vehicles/${vehicleId}`, data),
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
  getAgencyBookings: () => api.get('/agency/bookings'),
  assignAgencyBooking: (bookingId, driverId, vehicleId) =>
    api.patch(`/agency/bookings/${bookingId}/assign`, { driverId, vehicleId })
};

export default agencyService;
