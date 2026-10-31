export const bookingStatus = (booking) => {
  if (booking.bookingStatus === 'cancelled') return 'cancelled';
  if (booking.bookingStatus === 'completed') return 'completed';
  if (booking.bookingStatus === 'in-progress') return 'in-progress';
  if (booking.bookingStatus === 'rejected' || booking.assignmentStatus === 'rejected') return 'rejected';
  if (booking.bookingStatus === 'accepted' || booking.assignmentStatus === 'accepted') return 'accepted';
  if (booking.assignmentStatus === 'pending_acceptance' || booking.driver) return 'pending_acceptance';
  return 'unassigned';
};

export const bookingStatusLabel = (status) => ({
  unassigned: 'Pending Agency Assignment',
  pending_acceptance: 'Awaiting Driver Acceptance',
  rejected: 'Driver Rejected',
  accepted: 'Driver Accepted',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
}[status] || 'Pending Agency Assignment');

export const assignmentStatusLabel = (status) => ({
  unassigned: 'Not assigned',
  pending_acceptance: 'Awaiting driver',
  accepted: 'Accepted',
  rejected: 'Rejected'
}[status] || 'Not assigned');

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

export const formatTimestamp = (value) => {
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

export const formatScheduledDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
};

export const formatScheduledTime = (value) => {
  if (typeof value !== 'string' || !value.trim()) return 'Not available';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return value;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59 || (match[3] && (hours < 1 || hours > 12))) return value;
  if (match[3]) {
    const meridiem = match[3].toUpperCase();
    hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0);
  }
  const date = new Date(Date.UTC(2020, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).format(date);
};

export const titleCase = (value) => {
  if (!value) return 'Not available';
  return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};
