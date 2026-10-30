# Admin & Agency Approval Workflow

## Agency Dashboard: Driver Joining Requests
- Agency Admins can view and manage driver joining requests for their agency under the "Driver Joining Requests" tab.
- Strict agency data isolation: Agency Admins can only act on requests linked to their own agency.
- Accept action moves the driver into the agency's registered fleet list while preserving pending Super Admin status.
- Reject action prompts for a mandatory reason, excluding the driver from dispatch assignments and vehicle allocation.
- Dashboard displays metrics:
  - Total registered drivers
  - Pending agency approval
  - Accepted by agency, pending Super Admin
  - Super Admin approved and fully eligible
  - Rejected or suspended drivers

## Super Admin Dashboard: Global Driver Management
- Filter driver registrations by workflow stage:
  - Pending Agency Approval
  - Agency Accepted, Pending Super Admin
  - Pending KYC Documents
  - Pending Final Driver Approval
  - Fully Approved
  - Rejected
  - Suspended
- Super Admin detail view presents:
  - Driver contact details
  - Selected agency name & ID
  - Stage 1 Agency Association status, decision timestamp, and reviewer
  - Stage 2 Identity Proof (Aadhaar) and Driving Licence reviews with secure temporary view URLs
  - Final Driver Approval action (enabled only when KYC documents are verified and agency association is accepted)
