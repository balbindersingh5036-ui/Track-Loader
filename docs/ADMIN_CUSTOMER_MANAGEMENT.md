# Admin Customer Management

## Overview

The Admin Panel customer module provides a role-scoped customer directory, account status management, a customer profile, booking history, recorded payment history, and persisted activity timestamps. It does not expose customer registration or operational booking/payment controls.

## Frontend architecture

- `admin-panel/src/pages/customers/Customers.jsx` owns list search, filters, sorting, summary cards, status updates, and pagination.
- `admin-panel/src/pages/customers/CustomerDetails.jsx` loads the profile, statistics, paginated bookings, and paginated payment records independently.
- `admin-panel/src/pages/customers/customerDashboard.css` contains responsive list/detail styles.
- `admin-panel/src/services/customerService.js` wraps the Admin customer endpoints.
- The existing React Router protects `/customers` and `/customers/:id` for Admin users. API requests use the existing authenticated Axios client.

## Backend APIs

Every endpoint below is mounted under `/api/admin/customers` and protected by `protect` and `adminOnly`.

| Method and path | Purpose |
|---|---|
| `GET /` | Paginated customer directory, page booking counts, and global customer summary statistics |
| `GET /:id` | Customer profile, booking status counts, and net payment total |
| `GET /:id/bookings` | Paginated bookings, scoped by the Booking `customer` reference |
| `GET /:id/payments` | Paginated Payment records, scoped by the Payment `customer` reference |
| `PATCH /:id/status` | Updates only a boolean `isActive` value for a record whose role is `customer` |

`GET /` accepts `page`, `limit` (maximum 100), `search`, `isActive`, `hasBookings`, `from`, `to`, `sortBy`, and `sortOrder`. Search covers name, email, phone, and a valid MongoDB customer ID. Registration dates are inclusive calendar dates in `YYYY-MM-DD`; the end date is implemented as an exclusive next-day UTC bound. Sort fields are restricted to `createdAt`, `name`, and `lastLoginAt`.

`GET /:id/bookings` accepts pagination, `bookingStatus`, and a Booking Reference search term. `GET /:id/payments` accepts pagination. Both validate that the requested ID belongs to an actual customer before querying records. Invalid IDs receive `400`; unknown/non-customer IDs receive `404`.

Responses follow the standard `{ success, data, message }` envelope. List responses provide `data.customers`, `data.stats`, and `data.pagination`. Detail provides `data.customer` and `data.stats`. History endpoints provide their records and pagination metadata.

## Data model and role filtering

Customers are `User` records. The list, detail, and status-write queries explicitly require `role: "customer"`; other roles are not treated as customers. Password and credential fields are excluded from the selected customer projection. The list exposes the existing `profileImage`, `isActive`, `createdAt`, and `lastLoginAt` fields.

The list booking count for each visible customer is calculated from `Booking.customer` ObjectId references. The with/without booking filter also uses those references, not name or phone matching. Booking history uses the same reference. Payment history uses `Payment.customer`; booking references are populated for display.

Customer summary counts are database counts over customer-role Users. “Recently Registered” means a `createdAt` value within the most recent 30 days. With/without booking counts count customer accounts with one or more matching Booking records. Detail booking statistics are grouped from the actual booking records. Net amount paid is aggregated from actual Payment records with `success` or `refunded` status, subtracting stored `refundAmount`; booking fares are not treated as payment transactions.

## Last login

The source is `User.lastLoginAt` (nullable Date). Customer login in `backend/src/controllers/authController.js` sets the timestamp to the current time and saves the User after successful password and role validation. Admin list and detail projections include `lastLoginAt`, and the frontend maps that exact field. A missing/null value is presented as “Not available”; no timestamp is synthesized or backfilled.

## Account status workflow

The list and profile offer an explicit Active/Inactive toggle with a confirmation naming the customer and prior/new status. The existing status API accepts only `{ isActive: boolean }`; its database filter remains customer-role scoped. The frontend refreshes the profile/list after a successful change and reports request failures rather than showing an empty success state. No deletion action is exposed.

## Search, filtering, and pagination

All list search, date/status/booking filters, sorting, and page limits are applied server-side. Page-specific booking counts are computed only for the current page’s customer IDs. Summary metrics remain global and are not changed by the current list filters. Booking history status/reference search and payment history pagination are separately scoped to the customer ID. The frontend distinguishes loading, empty, and failed states and offers retry controls.

## Authentication and authorization

The existing Admin customer router applies `protect` and `adminOnly` to all directory, detail, history, and status routes. The existing authorization middleware and account-status behavior are unchanged. No public Customer API or role-changing operation was added.

## Tests

Focused customer management regression tests:

```powershell
Set-Location E:\LoadBalbin\backend
node --test tests\admin-customer-dashboard.test.js tests\admin-management.test.js
```

Admin Panel build:

```powershell
Set-Location E:\LoadBalbin\admin-panel
npm run build
```

## Known limitations

- Login activity is not a persisted event history; only the latest nullable `lastLoginAt` value is available.
- Booking activity shown in the profile is derived from persisted assignment-history entries and booking timestamps on the currently loaded booking-history page(s), and payment activity from persisted transaction timestamps on the currently loaded payment page(s). It is not a complete audit/event stream.
- The current User model has no address or separate customer profile fields beyond name, email, phone, profile image, role, active state, creation time, and last-login time.
- Payment totals describe recorded payment transactions, not booking fare estimates or final fares. Legacy records without Payment documents remain absent from payment history.
