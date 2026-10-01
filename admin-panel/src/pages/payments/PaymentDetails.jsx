import ApiDetailPage from '../../components/common/ApiDetailPage';

export default function PaymentDetails() {
  return (
    <ApiDetailPage
      title="Payment"
      endpoint="/admin/payments"
      resource="payment"
      fields={[
        { label: 'Payment ID', path: 'paymentId' },
        { label: 'Booking', path: 'bookingId' },
        { label: 'Customer', render: (item) => item.customer?.name || item.customer?.phone || '—' },
        { label: 'Amount', render: (item) => `₹${item.amount}` },
        { label: 'Status', path: 'status' },
        { label: 'Method', path: 'method' },
        { label: 'Provider', path: 'provider' },
        { label: 'Transaction ID', path: 'transactionId' },
        { label: 'Order ID', path: 'orderId' },
        { label: 'Refund ID', path: 'refundId' },
        { label: 'Refund amount', render: (item) => item.refundAmount === undefined ? '—' : `₹${item.refundAmount}` }
      ]}
    />
  );
}
