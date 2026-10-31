import React from 'react';
import { titleCase } from './paymentDisplay';

export default function PaymentStatusBadge({ status }) {
  const supported = ['pending', 'success', 'failed', 'refunded', 'processed'].includes(status);
  return (
    <span className={`payment-status-badge ${supported ? `is-${status}` : 'is-unknown'}`}>
      <span aria-hidden="true" />
      {status === 'unknown' ? 'Needs Review' : supported ? titleCase(status) : status ? titleCase(status) : 'Not available'}
    </span>
  );
}
