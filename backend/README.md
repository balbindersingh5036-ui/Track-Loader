# Backend configuration

## Designated Super Admin for document review

Driver and vehicle document approval/rejection is restricted to the single
administrator whose MongoDB user ID is configured as `SUPER_ADMIN_USER_ID`.
The account must also be active and have the existing `admin` role.

Set `SUPER_ADMIN_USER_ID` in the backend deployment environment to the
pre-designated administrator's 24-character MongoDB user ID. Do not put this
value in client apps or commit deployment credentials. The backend fails
closed with HTTP 503 for document-review actions when this setting is missing
or invalid, and returns HTTP 403 for all other administrator accounts.

The application currently models administrators with a generic `admin` role;
it has no separate persisted Super Admin role. This environment-based
designation avoids changing any existing production user records. Configure
and verify the intended administrator ID with the deployment owner before
enabling document review in production.
