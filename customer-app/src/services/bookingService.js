import api from "./api";

export const bookingService = {
  async createBooking(booking) {
    const { data } = await api.post("/bookings", booking);
    return data.data.booking;
  },
  async getMyBookings(params = {}) {
    const { data } = await api.get("/bookings/my", { params });
    return data.data;
  },
  async getBooking(id) {
    const { data } = await api.get(`/bookings/${encodeURIComponent(id)}`);
    return data.data.booking;
  },
  async cancelBooking(id, reason) {
    const { data } = await api.patch(`/bookings/${encodeURIComponent(id)}/cancel`, { reason });
    return data.data.booking;
  }
};
export default bookingService;
