# Super Admin Payments Guide

## Find a transaction

Open **Payments** from the Admin Panel navigation. Search accepts a payment ID, booking reference, customer name, phone or email, Razorpay order ID, or transaction/payment ID. The search matches actual stored IDs and linked customer/booking records.

Use the status, method, provider, and date controls to narrow the results. The currently supported payment statuses are Pending, Success, Failed, and Refunded. Method/provider options reflect the values supported by the existing system and provider records returned by the API. Date ranges use UTC calendar days; displayed timestamps use the browser's local timezone.

Select **Clear filters** to reset the search, filters, sorting, and dates. Use the row count selector and Previous/Next controls to browse pages. Summary cards show global API totals; selecting a count card applies the corresponding payment status filter.

## Read the payment table

The table separates the actual payment amount from the booking reference and transaction status. Customer information and booking details are shown only when the related database records exist. A missing relation or amount is shown as unavailable rather than replaced with a guessed value.

Refund status and amount are shown from stored refund data. A pending refund is not counted as completed refunded money. The Successful Amount summary includes records with `success` status only; Refunded Amount includes completed records with `refunded` payment status only.

## View payment details

Select the Payment ID or **Details**. The detail page shows the payment record, linked customer and booking, gateway order/payment IDs, recorded refund references, and the estimated fare, final fare, and actual payment amount as distinct values. Use the copy icon to copy an available ID. Missing gateway IDs and missing linked records are explicitly identified.

Gateway credentials and signatures are never displayed. The current backend does not store a refund reason, tax/discount breakdown, or complete gateway response.

## Understand statuses and timestamps

Payment status is the stored backend status: Pending, Success, Failed, or Refunded. Refund provider status is separately shown as Pending, Processed, Failed, or Needs Review when the provider response is incomplete. A payment with a pending refund is not labeled Refunded until the provider confirms processing.

The transaction timestamp uses `paidAt` when available and otherwise the payment record's creation time. The display includes the browser timezone abbreviation. A missing timestamp is shown as Not Available.

## Initiate an eligible full refund

The **Refund** action appears only when the backend marks a payment eligible. Eligibility requires a successful payment, a positive recorded amount, a transaction ID, and no existing refund ID or recorded refund amount. The backend repeats these checks; frontend visibility is not the authorization boundary.

Before confirming, review the payment ID, booking reference, customer, original amount, previously refunded amount, and refundable amount. Confirming sends a real full-refund request through the configured Razorpay integration. Do not use the action as a test; use an isolated gateway configuration for testing.

After the request:

- **Processed** means the provider reported completion; payment and booking are updated as refunded.
- **Pending** means the request was accepted but is not yet confirmed; the signed provider webhook updates it after processing.
- **Failed** means the provider reported failure. The reference is retained for review; do not retry automatically.
- **Needs Review** means the provider response was incomplete or unrecognized. The attempt is locked against another refund request; check Razorpay before taking further action.

The current action does not support partial refunds. A payment with a recorded refund amount is not offered for another full refund.

## Pending and failed payments

Pending and failed payments cannot be refunded from this module. The UI does not offer a manual status-success action. Verify payment outcomes through the existing provider verification/webhook flow. For provider-side refund failure, pending states that do not update, or Needs Review, reconcile the transaction in Razorpay and follow the platform's finance escalation process.
