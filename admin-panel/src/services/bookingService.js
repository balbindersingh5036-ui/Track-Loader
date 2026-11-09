import api from './api';

export const bookingService = {
  getBookings: (params) => api.get('/admin/bookings', { params }),
  getBooking: (bookingId) => api.get(`/admin/bookings/${encodeURIComponent(bookingId)}`),
  confirmCashCollection: (bookingId, notes) => api.post(`/payments/${encodeURIComponent(bookingId)}/cash-collection`, { notes })
};
export default bookingService;