import api from "./api";

export const paymentService = {
  async createOrder(bookingId) {
    const { data } = await api.post("/payments/create-order", { bookingId });
    return data.data;
  },
  async verifyPayment(details) {
    const { data } = await api.post("/payments/verify", details);
    return data.data;
  },
  async getPaymentStatus(bookingId) {
    const { data } = await api.get(`/payments/${encodeURIComponent(bookingId)}`);
    return data.data;
  }
};
export default paymentService;
