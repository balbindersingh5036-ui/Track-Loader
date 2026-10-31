# Admin Payment Management

## Architecture

The Super Admin payment pages are implemented in `admin-panel/src/pages/payments/` and use `admin-panel/src/services/paymentService.js`. Requests use the existing Axios instance, which attaches the Admin session token. Backend routes are mounted at `/api/admin/payments` and apply `protect` followed by `adminOnly`.

The admin payment controller reads `Payment` records and resolves the existing `Booking` and `User` relations. It returns explicit safe projections; it does not expose Razorpay credentials, API secrets, signatures, or complete provider payloads.

## Payment model and current statuses

`backend/src/models/Payment.js` stores:

- Booking and customer ObjectId relations.
- Amount in INR, payment method, provider, gateway order ID, and transaction/payment ID.
- Payment status, paid timestamp, refund amount, refund ID, and refund completion timestamp.
- Refund provider status and initiation timestamp.
- Mongoose creation and update timestamps.

Payment statuses currently supported by the schema and UI are `pending`, `success`, `failed`, and `refunded`. A `processing`, `cancelled`, or `partially-refunded` payment status is not implemented. Refund provider statuses are `pending`, `processed`, `failed`, and `unknown`. A pending or unknown refund does not cause the payment to be represented as refunded.

Payment method values currently supported are `online` and `cash`. The provider filter is populated from actual non-empty provider values present in Payment records; Razorpay is the provider integrated by the existing payment service.

## Admin API

### List and summaries

`GET /api/admin/payments`

Supported query parameters:

- `page`, `limit` (maximum 100).
- `search`: partial payment ID, booking reference, customer name/phone/email, gateway order ID, or transaction/payment ID.
- `status`: one of the stored payment statuses.
- `method`: one of the stored payment methods.
- `provider`: exact provider value.
- `from`, `to`: inclusive calendar dates in `YYYY-MM-DD` form, applied to payment record `createdAt` using UTC day boundaries.
- `sortBy`: `date`, `amount`, or `status`; `sortOrder`: `asc` or `desc`.

The response contains:

- `data.payments`: the requested page with safe payment, customer, and booking projections.
- `data.pagination`: page, limit, filtered total, and total pages.
- `data.summary`: global counts and amounts computed from actual Payment records, independent of active list filters.
- `data.facets`: implemented statuses and methods, and provider values observed in the records.

`successfulAmount` sums `success` records and subtracts a recorded refund only when its refund provider status is `processed`. `refundedAmount` includes fully refunded records and completed partial refunds recorded against a still-successful payment. Pending, failed, and unknown refund outcomes are not counted as completed refunded money.

### Details

`GET /api/admin/payments/:id` returns `data.payment` with the actual linked User and Booking when those relations exist. Missing or deleted relations are represented as unavailable; no name-based relation matching is performed.

### Refund

`POST /api/admin/payments/:paymentId/refund` reuses the existing Razorpay refund integration. Backend checks require a successful payment with a valid transaction ID and positive amount and reject records already carrying a refund ID or recorded refund. The endpoint remains behind the same protected Admin routes.

The backend atomically claims an eligible payment before calling Razorpay, preventing concurrent duplicate requests. The gateway response ID, status, amount, and initiation time are recorded. The stored refund amount is converted from gateway paise to INR. `processed` updates the payment and booking to refunded and triggers the existing customer notification/socket event. `pending` remains pending until a signed `refund.processed` webhook updates it. A signed `refund.failed` event records failure and does not mark the payment or booking refunded. Provider errors or unknown/incomplete gateway responses are retained as `unknown` when possible to prevent an unsafe retry. Such records require review in the Razorpay dashboard.

The webhook continues to verify the existing Razorpay webhook signature before processing events. Payment capture/failure handling remains in place.

The refund API currently creates a full refund only. It does not accept a refund reason, implement a partial-refund action, or provide a refund history collection. The UI does not fabricate those data points. Records with existing refund amounts are not eligible for another full refund action.

## Data accuracy and security

- List and detail access uses `protect` and `adminOnly`.
- Booking and customer details come from Payment's ObjectId relations.
- Summary values are calculated at request time from stored Payment records, not hardcoded or sourced from booking fares.
- Booking estimated fare, final fare, and actual Payment amount are shown separately.
- Missing monetary values are shown as unavailable. An actual zero from the database remains a real zero.
- Payment date uses `paidAt` when present, otherwise the payment record's `createdAt`; display timezone is the Admin browser's local timezone and includes its timezone abbreviation.
- Refund completion is not inferred from an HTTP 200 response: the UI checks the returned stored refund status and ID, and differentiates processed, pending, failed, and unknown outcomes.
- No live production database audit or count reconciliation was performed during this implementation. The list API's summary is the authoritative live reconciliation when called by an authenticated Admin.

## Error handling

Invalid pagination, filters, dates, and ObjectIds return validation errors. The UI surfaces API errors and provides retry; an empty state is shown only after a successful list response. Refund failures and provider-pending outcomes are not shown as processed success. Gateway errors are logged without logging full provider error objects or credentials.

## Tests and build

From `backend`:

```powershell
node --test tests\admin-payment-dashboard.test.js tests\payment.test.js
```

The admin dashboard tests mock Mongoose model calls and do not connect to a production database or send refunds to Razorpay. The existing `payment-signature.test.js` includes a read-only provider lookup for a fabricated payment ID; run that separately only with an isolated/test gateway configuration.

From `admin-panel`:

```powershell
npm run build
```

Required runtime settings are the existing MongoDB connection, Admin authentication configuration, and Razorpay credentials/webhook secret already required by the backend payment system. Never expose those secrets in frontend configuration.

## Known limitations

- A live payment count and duplicate/relationship audit requires an authenticated Admin API session; no production payment records were inspected or changed here.
- Refund reason and full gateway response metadata are not stored.
- Partial refunds are not supported as an Admin action. A legacy record with a non-zero refund amount is excluded from further full refunds.
- A provider response with an unknown status or a failed refund requires manual provider-side review; no automatic retry is offered.
- Pagination summarizes the complete collection, but only the requested page is returned for the table.
