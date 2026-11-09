import api from './api';

export const driverService = {
  getProfile: () => api.get('/driver/profile'),
  updateStatus: (isOnline) => api.patch('/driver/status', { isOnline }),
  requestAgencyAssociation: (agencyId) => api.patch('/driver/agency-request', { agencyId }),
  getVehicles: () => api.get('/driver/vehicles'),
  getDocument: (driverId, docType) => api.get(`/documents/driver/${driverId}/${docType}`),
  getVehicleDocument: (vehicleId, docType) => api.get(`/documents/vehicle/${vehicleId}/${docType}`),
  uploadDocument: (driverId, docType, data, onUploadProgress) =>
    api.post(`/documents/driver/${driverId}/${docType}`, data, {
      timeout: 120000,
      onUploadProgress
    }),
  uploadVehicleDocument: (vehicleId, docType, data, onUploadProgress) =>
    api.post(`/documents/vehicle/${vehicleId}/${docType}`, data, {
      timeout: 120000,
      onUploadProgress
    }),
  updateLocation: (coords) => api.patch('/driver/location', coords),
  /**
   * On-demand single location snapshot.
   * Never runs continuous background tracking or causes battery drain.
   */
  requestLocationSnapshot: () => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return reject(new Error('Geolocation is not supported on this platform'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }
};

export default driverService;
