# Backend configuration

## Driver registration and Super Admin approval

Drivers may request an agency association with `POST /api/auth/driver/register`.
The optional `agencyId` must refer to an active, approved agency. Independent
drivers may omit it. Agency options are returned by the public
`GET /api/agency/verified` endpoint, which returns only the agency ID, public
name, and city. A successful registration creates one `User` and one `Driver`
record linked through `Driver.user`; `Driver.agency` stores the optional agency
reference. New drivers remain pending and receive no authenticated session.

Driver and vehicle document review, plus driver approve/reject/suspend actions,
are restricted to the single administrator whose MongoDB user ID is configured
as `SUPER_ADMIN_USER_ID`. The account must also be active and have the existing
`admin` role.

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
