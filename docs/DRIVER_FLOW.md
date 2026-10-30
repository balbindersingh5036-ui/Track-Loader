# Driver Workflow & Dual Approval System

## Driver Registration & Association
1. **Agency-Linked Driver**:
   - The driver selects an active, verified transport agency from the database-backed list during registration.
   - Initial state:
     - `approvalStatus`: `pending` (Super Admin driver approval)
     - `agencyAssociation.status`: `pending` (Agency Admin joining approval)
   - Authenticated access is granted to the Driver App's restricted KYC-pending mode immediately upon registration and sign-in.
   - Agency relationship is not automatically approved.

2. **Independent Driver**:
   - Driver selects the independent option (`agency: null`).
   - `agencyAssociation.status`: `none` (No agency approval required).
   - Driver requires Super Admin KYC verification and vehicle document approval.

## First Approval: Agency Admin Review
- Joining requests appear in the selected agency's dashboard under "Driver Joining Requests".
- The Agency Admin can accept or reject the driver association request.
- A rejection requires a mandatory rejection reason and allows the driver to select another agency from the Driver App.
- Agency acceptance only updates `agencyAssociation.status = "approved"`. It does **not** grant KYC approval or final driver account approval.

## Second Approval: Super Admin KYC Verification
- Super Admin verifies Aadhaar (Identity Proof) and Driving Licence documents.
- Super Admin performs final driver account approval only when:
  1. Both identity documents are approved.
  2. If agency-linked, the related agency admin has accepted the driver association.

## Final Platform Eligibility Conditions
Online availability and dispatch bookings require ALL of the following:
1. Driver account is active.
2. Super Admin final approval status is `approved`.
3. Aadhaar / Identity Proof status is `approved`.
4. Driving Licence status is `approved`.
5. Selected agency is active and approved (for agency-linked drivers).
6. Agency Admin has accepted the association (for agency-linked drivers).
7. An appropriate active and available vehicle is assigned.
8. Vehicle RC and insurance documents are approved.
