# Super Admin Vehicle Management

## 1. Module overview

The Admin Panel Vehicles area lists real `Vehicle` records, summarizes fleet and document counts, supports server-side search/filter/sort/pagination, and opens an administrative vehicle detail page. The detail page shows vehicle photos, its actual `Vehicle.driver` and `Vehicle.agency` relations, and the two independent private vehicle documents: RC (`documents.registration`) and Insurance (`documents.insurance`).

Document content is delivered through the authenticated document-view API as a short-lived URL. In the Admin Panel, a normal Admin may inspect vehicle metadata but cannot receive a private RC/Insurance preview or approve documents. Only the configured designated Super Admin can view and review documents there. Existing Driver and Agency Owner access remains limited to their own authorized vehicle relation.

## 2. Existing architecture and files

- `backend/src/models/Vehicle.js` — vehicle, photo, assignment and document schemas.
- `backend/src/controllers/vehicleController.js` — Admin vehicle listing, detail, update, document review, and activation validation.
- `backend/src/controllers/documentController.js` — private vehicle document upload and resubmission.
- `backend/src/routes/adminVehicleRoutes.js` — authenticated Admin vehicle APIs; document review is additionally protected by `superAdminOnly`.
- `backend/src/routes/documentRoutes.js` — authenticated document view/upload APIs.
- `backend/src/utils/vehicleDocumentResponse.js` — removes private storage identifiers and only creates signed URLs when explicitly requested.
- `backend/src/utils/driverEligibility.js` — existing driver, vehicle, and dispatch eligibility rules reused for activation.
- `admin-panel/src/pages/vehicles/Vehicles.jsx` — vehicle dashboard.
- `admin-panel/src/pages/vehicles/VehicleDetails.jsx` — detail, gallery, document review, and secure preview UI.
- `admin-panel/src/services/vehicleService.js` — Admin API wrappers.

## 3. Vehicle data model

The implementation reuses the existing Vehicle model. No migration or destructive data change is required.

- `vehicleImage`: legacy/primary photo URL.
- `vehicleImages`: up to four photo URLs.
- `driver`: reference to the assigned Driver profile; it is not inferred from a User's name or agency.
- `agency`: reference to the managing Agency, if any.
- `documents.registration` and `documents.insurance`: separate private document records, each with URL/reference, file format, status, submission/review metadata, rejection reason and review history.
- Document `reviewHistory` records previous status, new status, reviewer, timestamp and rejection reason for each review. Existing stored documents retain compatibility and acquire history entries from new reviews onward.

The original upload filename is not stored by the current document schema; the Admin UI identifies the document by its type and persisted file format.

## 4. Vehicle photos

Agency Owners upload optional images through the existing Agency fleet routes. The upload form accepts 0–4 JPG/JPEG, PNG, or WEBP images of at most 5 MB each. The server verifies the content signature, stores listing images in the existing public vehicle-photo Cloudinary folder, and saves their HTTPS URLs in `vehicleImages` and the primary URL in `vehicleImage`. RC and Insurance records are not affected.

The Admin table displays the primary photo, with a placeholder when none is available or its URL cannot be loaded. Vehicle Details shows up to four thumbnails and a larger gallery with previous/next navigation. The Admin cannot replace or delete photos through this module.

Agency fleet photo routes:

- `POST /api/agency/vehicles` — create a vehicle; optional repeated multipart `photos` fields.
- `PUT /api/agency/vehicles/:id` — update vehicle metadata/photos; multipart `existingPhotos` contains retained existing URLs and repeated `photos` fields contain new uploads.

## 5. RC document workflow

Agency Owners submit RC files through `POST /api/documents/vehicle/:vehicleId/registration`. The server validates supported image/PDF content and stores the asset in the private authenticated KYC vault. A new or resubmitted RC is `pending`; resubmission retains prior review history and does not approve the document.

The designated Super Admin opens the vehicle detail page and uses **View RC** to request a temporary authorized URL. They can approve the RC or reject it with a required 1–500 character reason. The backend updates only `documents.registration`, records reviewer/time/reason and appends review history.

## 6. Insurance document workflow

Insurance uses the same upload, preview, and review flow at `POST /api/documents/vehicle/:vehicleId/insurance` and `GET /api/documents/vehicle/:vehicleId/insurance`. Its state is stored independently at `documents.insurance`; an RC decision never changes Insurance status, and vice versa.

## 7. API endpoints

All Admin Panel calls use the existing Bearer token stored in `adminToken`. API successes use `{ "success": true, "message": "...", "data": ... }`; errors use `{ "success": false, "message": "...", "errors": null }`.

### Vehicle list and detail

- `GET /api/admin/vehicles?page=1&limit=20&search=...&status=active&assigned=false&availability=true&vehicleType=pickup&registrationStatus=pending&insuranceStatus=approved&sortBy=createdAt&sortOrder=desc`
  - `status`: `active` or `inactive`.
  - `assigned` / `availability`: `true` or `false`.
  - `vehicleType`: one of `mini-truck`, `pickup`, `small-truck`, `medium-truck`, `large-truck`.
  - Document statuses accept `missing`, `pending`, `approved`, `rejected`; `missing` also matches records with no persisted status/document. An uploaded legacy document with no persisted status is counted/filtered as pending.
  - Search matches vehicle registration/model/category, Driver name/phone, or Agency name/phone/email.
  - `sortBy`: `vehicleNumber`, `vehicleModel`, or `createdAt`; `sortOrder`: `asc` or `desc`; page size maximum is 100.
  - The response contains `data.vehicles`, global unfiltered `data.stats`, and `data.pagination`. `rejectedDocuments` counts rejected document records (RC and Insurance separately), not unique vehicles.

Example response:

```json
{
  "success": true,
  "message": "Vehicles fetched successfully",
  "data": {
    "vehicles": [{
      "_id": "507f1f77bcf86cd799439011",
      "vehicleNumber": "PB10AB1234",
      "vehicleModel": "Tata 407",
      "vehicleType": "mini-truck",
      "vehicleImages": [],
      "isActive": true,
      "isAvailable": true,
      "driver": null,
      "agency": null,
      "documents": {
        "registration": { "status": "pending", "viewUrl": null },
        "insurance": { "status": "not_uploaded", "viewUrl": null }
      }
    }],
    "stats": {
      "total": 12,
      "active": 10,
      "inactive": 2,
      "available": 8,
      "assigned": 5,
      "pendingRegistration": 2,
      "pendingInsurance": 1,
      "rejectedDocuments": 1
    },
    "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
  }
}
```

The values above illustrate response shape only; live counts come from MongoDB.

- `GET /api/admin/vehicles/:id` — complete Admin detail data, actual populated Agency and Driver relations, document metadata and review history. It never includes signed private preview URLs. `canViewDocuments` and `canReviewDocuments` are true only for the designated Super Admin.
- `PUT /api/admin/vehicles/:id` — existing Admin vehicle update API; the Admin UI preserves vehicle metadata editing. The API accepts the pre-existing `vehicleImage` / `vehicleImages` fields (maximum four array entries), but the new Admin interface does not expose photo replacement controls. Document review fields are not editable through this request.

### Secure vehicle document APIs

- `GET /api/documents/vehicle/:vehicleId/registration`
- `GET /api/documents/vehicle/:vehicleId/insurance`
  - Returns a fresh `data.document.viewUrl`, format, status, submission date, rejection reason and `expiresInSeconds` (300).
  - A designated Super Admin, the assigned Driver, or the authenticated managing Agency Owner can view within their existing server-side authorization boundary. Ordinary Admin accounts are denied. Vehicle-document previews require a `loadbalbin_kyc/` private-vault asset; legacy public URLs are not returned and require safe resubmission.
  - The Admin Panel does not persist the signed URL; it keeps it in memory only for the open preview.
- `POST /api/documents/vehicle/:vehicleId/registration`
- `POST /api/documents/vehicle/:vehicleId/insurance`
  - Multipart field: `document`. Agency Owner must own the vehicle's Agency; a Driver may submit only for their own eligible independent vehicle.

### Document review

- `PATCH /api/admin/vehicles/:id/documents/registration/approve`
- `PATCH /api/admin/vehicles/:id/documents/registration/reject` with `{ "reason": "..." }`
- Same routes with `insurance` as `:docType`.

The route requires authentication, Admin role and the designated `SUPER_ADMIN_USER_ID`. Missing or invalid configuration fails closed (503); a different Admin receives 403. Only a submitted pending private-vault document can be reviewed. Rejection requires a reason.

### Active state

- `PATCH /api/admin/vehicles/:id/status` with `{ "isActive": true }` or `{ "isActive": false }`.
- Repeated current status is a no-op success.
- Activation requires approved RC and Insurance; an associated Agency must be active and approved; an assigned Driver must pass existing assignment eligibility checks.
- State changes are rejected while the Vehicle has an accepted/in-progress booking or pending-acceptance/accepted assignment. Deactivation is also rejected until an assigned Driver is unassigned.

## 8. Authentication and authorization

- `/api/admin/vehicles` routes require `protect` and `adminOnly`.
- Document review routes additionally require `superAdminOnly`, which compares the authenticated Admin ID to the configured `SUPER_ADMIN_USER_ID` and fails closed if configuration is absent/invalid.
- Private document viewing is issued by the authenticated document API, not by the general list/detail API. The Admin Panel hides the View action from non-designated Admins, while the backend independently denies them.
- Agency and Driver document routes retain their own ownership checks.
- Vehicle relationship display uses the actual `Vehicle.driver` and `Vehicle.agency` references. An Agency Owner account is never substituted for a Driver profile.

## 9. Status definitions and transitions

- `not_uploaded` (UI: Missing): no document is available.
- `pending`: a private document has been submitted and is awaiting review.
- `approved`: the designated Super Admin approved that document.
- `rejected`: the document was rejected with a reason; the Agency can resubmit it, which returns that document to `pending`.

Only pending documents can be reviewed. RC and Insurance transitions are independent. Legacy records without status are treated as missing when no document exists and as pending by the secure document serializer when an uploaded document exists.

## 10. Super Admin actions and permissions

The Admin Panel supports metadata inspection/editing, photo viewing, secure document preview, independent RC/Insurance approval or rejection, and vehicle activation controls. Vehicle assignment is read-only here: the Agency retains driver assignment authority. The Admin cannot alter photo files or approve/reject through Agency endpoints.

## 11. Error handling

Invalid query parameters or IDs return 400; absent vehicle/documents return 404; unauthorized document/review requests return 403; rejected state transitions return 409; missing Super Admin configuration returns 503. The UI presents list errors with retry, disables controls while actions run, requires rejection reasons, and permits fresh signed-link requests if a preview expires or fails.

## 12. Tests and execution

Focused, database-free regression tests use mocked model and Cloudinary operations:

```powershell
Set-Location E:\LoadBalbin\backend
npm test -- tests\vehicle-admin-dashboard.test.js tests\profile-vehicle-api.test.js tests\document-workflow.test.js tests\super-admin-authorization.test.js
```

The tests cover server filtering/count response shape, missing-document filtering, private URL omission from general details, independent review/history, resubmission history preservation, secure authorization middleware, and activation eligibility/active-booking constraints.

Build the Admin Panel:

```powershell
Set-Location E:\LoadBalbin\admin-panel
npm run build
```

## 13. Deployment and environment

- Preserve the existing MongoDB Vehicle collection; no data migration is needed for photo fields.
- Configure `SUPER_ADMIN_USER_ID` with the designated Admin's MongoDB ObjectId. Without a valid value, document review/view is denied.
- Keep Cloudinary credentials on the backend only. Private document assets remain in the authenticated `loadbalbin_kyc` storage; vehicle listing photos remain in the public vehicle-photo folder.
- Configure the Admin Panel `VITE_API_URL` to the backend API base.
- Deploy the backend and Admin Panel together so their request/response contracts match.

## 14. Known limitations and pending work

- The existing document schema does not retain original uploaded filenames; the UI displays document type and available format instead.
- Vehicle photo labels are positional (Photo 1–4); photo orientation is not inferred or enforced.
- Older review events cannot be reconstructed; review history begins when the new review flow records events.
- The production Vite build may emit the repository's existing large JavaScript chunk-size advisory; it does not fail the build.
