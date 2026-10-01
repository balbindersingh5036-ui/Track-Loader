import api from './api';

export const ratingService = {
  async createRating(payload) {
    const { data } = await api.post('/ratings', payload);
    return data.data.rating;
  },
  async getBookingRating(bookingId) {
    const { data } = await api.get(`/ratings/booking/${encodeURIComponent(bookingId)}`);
    return data.data.rating;
  }
};
export default ratingService;
