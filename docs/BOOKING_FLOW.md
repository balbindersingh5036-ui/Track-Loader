# Booking assignment and trip lifecycle

## Authority

- Customers create and cancel their own bookings.
- An agency owner assigns an eligible agency driver and compatible vehicle.
- The assigned driver personally accepts or rejects the assignment, then starts and completes the trip.
- Super Admin booking screens are read-only. Emergency/support procedures remain separate from ordinary booking operations.

## Lifecycle

`bookingStatus` remains `pending` while awaiting agency assignment or a driver's response. `assignmentStatus` distinguishes:

- `unassigned`: waiting for an agency to assign a driver.
- `pending_acceptance`: assigned to a driver; driver response is pending.
- `accepted`: the assigned driver accepted; `bookingStatus` is `accepted`.
- `rejected`: the driver declined; the assignment is released, while `bookingStatus` returns/remains `pending` for permitted agency reassignment.

After acceptance, the assigned driver advances `bookingStatus` through `in-progress` to `completed`. Customer cancellation continues to use `cancelled`. Assignment events and actor/timestamps are recorded in `assignmentHistory`; lifecycle timestamps remain on the booking.

## APIs

- `POST /api/bookings`: customer creates a booking. A selected agency vehicle routes the booking to that vehicle's agency. The agency-only assignment option supplies an approved `agencyId`; the backend validates that the agency has eligible capacity.
- `PATCH /api/bookings/:id/cancel`: customer cancellation, subject to the existing cancellation setting and status rules.
- `GET /api/agency/bookings`: authenticated agency-scoped booking list.
- `PATCH /api/agency/bookings/:id/assign`: authenticated agency owner assigns `{ driverId, vehicleId }`. The backend validates agency ownership, driver and vehicle KYC/approval, availability, type, and capacity, then reserves the vehicle. Assignment is not acceptance.
- `GET /api/driver/bookings/requests`: lists only bookings assigned to the authenticated eligible driver.
- `PATCH /api/driver/bookings/:id/accept`: only the assigned driver may atomically accept an awaiting assignment.
- `PATCH /api/driver/bookings/:id/reject`: only the assigned driver may reject; the booking assignment and reserved vehicle are released for agency reassignment.
- `PATCH /api/driver/bookings/:id/start` and `/complete`: trip lifecycle actions are restricted to the assigned driver.
- `GET /api/admin/bookings` and `GET /api/admin/bookings/:id`: Super Admin monitoring, search/filter, and details/history. The ordinary admin booking API exposes no assignment or lifecycle mutation routes.

Agency assignment and driver response notify the relevant driver/customer/agency through the existing notification and Socket.IO services. Assignment and acceptance updates use conditional database writes so a released or already accepted booking cannot be claimed concurrently.
