import api from './api';

export const bookingService = {
  getRequests: (params) => api.get('/driver/bookings/requests', { params }),
  getMyBookings: (params) => api.get('/driver/bookings/my', { params }),
  acceptBooking: (id) => api.patch(`/driver/bookings/${id}/accept`),
  rejectBooking: (id, reason) => api.patch(`/driver/bookings/${id}/reject`, { reason }),
  startTrip: (id) => api.patch(`/driver/bookings/${id}/start`),
  completeTrip: (id) => api.patch(`/driver/bookings/${id}/complete`)
};

export default bookingService;