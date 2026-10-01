import React from 'react';
import api from '../../services/api';
import ApiListPage from '../../components/common/ApiListPage';

export default function Payments() {
  return (
    <ApiListPage
      title="Payments"
      endpoint="/admin/payments"
      collection="payments"
      rowKey="paymentId"
      detailPath={(item) => `/payments/${item.paymentId}`}
      columns={[
        { label: 'Payment', render: (item) => String(item.paymentId || '').slice(-6) },
        { label: 'Booking', render: (item) => item.bookingId?.bookingId || String(item.bookingId || '').slice(-6) },
        { label: 'Customer', path: 'customer.name' },
        { label: 'Amount', render: (item) => `₹${item.amount}` },
        { label: 'Status', path: 'status' },
        { label: 'Method', path: 'method' }
      ]}
      actions={[{
        label: 'Refund full payment',
        disabled: (item) => item.status !== 'success' || Boolean(item.refundId),
        run: async (item) => {
          if (!window.confirm('This sends a full refund request to the payment provider. Continue?')) return;
          await api.post(`/admin/payments/${item.paymentId}/refund`);
        }
      }]}
    />
  );
}