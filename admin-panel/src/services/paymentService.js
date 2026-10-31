import api from './api';

export const paymentService = {
  getPayments: (params) => api.get('/admin/payments', { params }),
  getPayment: (paymentId) => api.get(`/admin/payments/${encodeURIComponent(paymentId)}`),
  refundPayment: (paymentId) => api.post(`/admin/payments/${encodeURIComponent(paymentId)}/refund`)
};
export default paymentService;