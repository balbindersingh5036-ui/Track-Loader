import api from './api';

export const customerService = {
  getCustomers: (params) => api.get('/admin/customers', { params }),
  getCustomer: (customerId) => api.get(`/admin/customers/${encodeURIComponent(customerId)}`),
  updateStatus: (customerId, isActive) => api.patch(
    `/admin/customers/${encodeURIComponent(customerId)}/status`,
    { isActive }
  ),
  getBookings: (customerId, params) => api.get(
    `/admin/customers/${encodeURIComponent(customerId)}/bookings`,
    { params }
  ),
  getPayments: (customerId, params) => api.get(
    `/admin/customers/${encodeURIComponent(customerId)}/payments`,
    { params }
  )
};
export default customerService;