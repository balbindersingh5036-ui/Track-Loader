# Backend configuration

## Driver registration and Super Admin approval

Drivers may request an agency association with `POST /api/auth/driver/register`.
The optional `agencyId` must refer to an active, approved agency. Independent
drivers may omit it. Agency options are returned by the public
`GET /api/agency/verified` endpoint, which returns only the agency ID, public
name, and city. A successful registration creates one `User` and one `Driver`
record linked through `Driver.user`; `Driver.agency` stores the optional agency
reference. New drivers remain pending and receive no authenticated session.

Agency, driver, and vehicle document review, plus agency and driver
approve/reject/suspend actions, are restricted to the single administrator
whose MongoDB user ID is configured as `SUPER_ADMIN_USER_ID`. The account must
also be active and have the existing `admin` role.

Agency owners may upload Owner Aadhaar, business registration, and tax
documents through the authenticated private-document endpoint. Document
decisions are recorded separately from agency approval and do not change the
agency's active or approval status. Business registration and tax documents
remain optional. The current backend does not require Owner Aadhaar approval
for agency approval or inclusion in the driver-registration dropdown; that
dropdown uses only `approvalStatus: "approved"` and `isActive: true`. Changing
this policy requires an explicit product decision and corresponding server-side
eligibility checks.

Agency registration creates a pending profile without KYC document references.
Owners must submit documents afterward through the authenticated private
upload endpoint; client-supplied URLs, storage IDs, and review statuses are
rejected during profile registration.

Agency approval and agency document-review actions are Super Admin-only.
Earlier agency approval records contain only their current `approvedAt` and
`approvedBy` values; subsequent agency/document decisions are appended to the
agency review history.

Set `SUPER_ADMIN_USER_ID` in the backend deployment environment to the
pre-designated administrator's 24-character MongoDB user ID. Do not put this
value in client apps or commit deployment credentials. The backend fails
closed with HTTP 503 for document-review actions when this setting is missing
or invalid, and returns HTTP 403 for all other administrator accounts. Agency
admins may manage only their own drivers and submit private KYC documents; they
cannot perform final driver approval or KYC review.

The application currently models administrators with a generic `admin` role;
it has no separate persisted Super Admin role. This environment-based
designation avoids changing any existing production user records. Configure
and verify the intended administrator ID with the deployment owner before
enabling document review in production.
