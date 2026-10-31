import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { formatMoney } from './paymentDisplay';

export default function PaymentRefundDialog({ payment, busy, onClose, onConfirm }) {
  const alreadyRefunded = Number(payment?.refundAmount || 0);
  const refundable = Math.max(0, Number(payment?.amount || 0) - alreadyRefunded);
  const bookingReference = payment.booking?.bookingId || (typeof payment.bookingId === 'string' ? payment.bookingId : 'Not available');
  return (
    <div className="payment-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="payment-refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title">
        <button className="payment-dialog-close" type="button" onClick={onClose} disabled={busy} aria-label="Close refund confirmation"><X size={19} /></button>
        <span className="payment-dialog-icon"><ShieldAlert size={23} /></span>
        <h2 id="refund-dialog-title">Confirm full refund</h2>
        <p className="payment-dialog-warning">This action sends a real refund request to the configured payment gateway. Verify the transaction before continuing.</p>
        <dl className="payment-refund-confirmation">
          <div><dt>Payment ID</dt><dd>{String(payment.paymentId)}</dd></div>
          <div><dt>Booking reference</dt><dd>{bookingReference}</dd></div>
          <div><dt>Customer</dt><dd>{payment.customer?.name || payment.customer?.phone || 'Not available'}</dd></div>
          <div><dt>Original payment</dt><dd>{formatMoney(payment.amount)}</dd></div>
          <div><dt>Already refunded</dt><dd>{formatMoney(payment.refundAmount ?? 0)}</dd></div>
          <div className="is-refundable"><dt>Refundable amount</dt><dd>{formatMoney(refundable)}</dd></div>
        </dl>
        <div className="payment-dialog-actions">
          <button type="button" className="payment-button payment-button-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="payment-button payment-button-danger" onClick={onConfirm} disabled={busy || refundable <= 0}>
            {busy ? <><span className="payment-button-spinner" /> Processing…</> : 'Confirm full refund'}
          </button>
        </div>
      </section>
    </div>
  );
}
