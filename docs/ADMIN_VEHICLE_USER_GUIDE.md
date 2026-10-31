# Super Admin Vehicle Management — User Guide

## Find a vehicle

1. Sign in to the Admin Panel and open **Vehicles**.
2. Search by registration, vehicle model/category, Driver name or phone, or Agency name/contact.
3. Use the filters for Active/Inactive, Assigned/Unassigned, category, RC status, and Insurance status. Use **Clear filters** to reset the search.
4. Click a summary card to filter the list to that metric. Counts reflect backend vehicle records.
5. Choose the page size, use Previous/Next, or click Registration, Model, or the default creation-date sort heading to change sort order.
6. Use **Refresh** or the retry action if loading fails.

## Open details and vehicle photos

1. Click **Details** for a vehicle row.
2. Review registration, category, capacity, body type, dates, Active/Available state, Agency, and actual assigned Driver profile details.
3. If photos exist, select **View photo gallery**. Select a thumbnail or use Previous/Next to browse. Missing or invalid photos show a placeholder/error state.
4. Admins may inspect the existing vehicle assignment but cannot assign or unassign a Driver from this page.
5. Vehicle metadata can be edited in the collapsed **Edit vehicle information** section. Photos are view-only in this UI.

## View RC

1. Open a vehicle's details and locate **Registration Certificate (RC)**.
2. Confirm the status, submission date, submitter, latest review metadata, and any rejection reason.
3. A designated Super Admin selects **View RC** to open the secure preview. The temporary link is requested from the backend when opened; select **Refresh preview** or **Retry secure fetch** if it expires or fails.
4. RC review controls are available only while the document is pending and only for the designated Super Admin.
5. Select **Approve** and confirm to approve RC only.
6. To reject RC, enter a clear reason and select **Reject**. Confirm the action. The reason is visible to the Agency Owner, who may resubmit; resubmission returns RC to Pending.

## View Insurance

1. Locate **Vehicle Insurance** in the same verification section.
2. Use **View Insurance** for a secure, short-lived preview.
3. Approve or reject Insurance independently from RC. Rejection requires a reason. The status of RC is not changed by an Insurance decision.

## Activate or deactivate

1. From the vehicle list or detail page, use **Activate** or **Deactivate** and confirm.
2. Activation requires approved RC and Insurance. If the vehicle has an Agency, that Agency must be active and approved; an assigned Driver must pass existing assignment eligibility checks.
3. The backend blocks status changes when an accepted/in-progress booking or pending-acceptance/accepted assignment exists. A Driver must be unassigned before deactivation.
4. If the backend rejects the action, read the displayed reason and resolve the booking, assignment, or eligibility issue before retrying. Activation does not approve documents or automatically assign a Driver.

## Understand verification statuses

- **Missing** — no document has been submitted.
- **Pending** — submitted and awaiting Super Admin review.
- **Approved** — approved by the designated Super Admin.
- **Rejected** — rejected with a reason; the Agency can upload a replacement, which returns that document to Pending.

RC and Insurance always have separate statuses and review histories. In the Admin Panel, only the configured designated Super Admin can view private RC/Insurance files or approve/reject them. Other Admin accounts can view vehicle metadata but cannot access private document content. Existing Driver and Agency Owner document access remains restricted to their own authorized vehicle relation.
