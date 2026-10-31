import React from 'react';
import { assignmentStatusLabel, bookingStatus, bookingStatusLabel } from './bookingDisplay';

const toneByStatus = {
  unassigned: 'warning',
  pending_acceptance: 'info',
  rejected: 'danger',
  accepted: 'success',
  'in-progress': 'purple',
  completed: 'success',
  cancelled: 'neutral'
};

export function BookingStatusBadge({ booking }) {
  const status = bookingStatus(booking);
  return <span className={`booking-badge booking-badge-${toneByStatus[status]}`}>{bookingStatusLabel(status)}</span>;
}

export function AssignmentStatusBadge({ status }) {
  const tone = status === 'accepted' ? 'success'
    : status === 'rejected' ? 'danger'
      : status === 'pending_acceptance' ? 'info' : 'neutral';
  return <span className={`booking-badge booking-badge-${tone}`}>{assignmentStatusLabel(status)}</span>;
}
