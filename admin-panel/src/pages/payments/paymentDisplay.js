export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'];

export const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return 'Not available';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPaymentDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
};

export const titleCase = (value) => value
  ? String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  : 'Not available';

export const paymentDate = (payment) => payment?.paidAt || payment?.createdAt;
