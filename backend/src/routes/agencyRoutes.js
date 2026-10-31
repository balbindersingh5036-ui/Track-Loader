import express from "express";
import {
  registerAgency,
  getVerifiedAgencies,
  getMyAgency,
  updateMyAgency,
  getAgencyDrivers,
  createAgencyDriver,
  updateAgencyDriverDocuments,
  getAgencyVehicles,
  createAgencyVehicle,
  updateAgencyVehicle,
  assignVehicleDriver,
  getAgencyBookings,
  assignAgencyBooking,
  getAgencyJoiningRequests,
  acceptAgencyDriverRequest,
  rejectAgencyDriverRequest,
  getAgencyStats
} from "../controllers/agencyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { agencyOnly } from "../middleware/agencyMiddleware.js";
import { handleUploadArray, handleUploadFields } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/verified", getVerifiedAgencies);

// Public agency registration (authenticated user applies to become agency owner)
router.post(
  "/register",
  protect,
  handleUploadFields(["ownerAadhaar", "businessRegistration", "tradeLicense", "gstCertificate", "taxId"]),
  registerAgency
);

// Agency owner management routes
router.get("/profile", protect, agencyOnly, getMyAgency);
router.get("/me", protect, agencyOnly, getMyAgency);
router.put("/profile", protect, agencyOnly, updateMyAgency);
router.put("/me", protect, agencyOnly, updateMyAgency);
router.get("/stats", protect, agencyOnly, getAgencyStats);
router.get("/driver-requests", protect, agencyOnly, getAgencyJoiningRequests);
router.patch("/driver-requests/:id/accept", protect, agencyOnly, acceptAgencyDriverRequest);
router.patch("/driver-requests/:id/reject", protect, agencyOnly, rejectAgencyDriverRequest);
router.get("/drivers", protect, agencyOnly, getAgencyDrivers);
router.post("/drivers", protect, agencyOnly, createAgencyDriver);
router.patch("/drivers/:id/accept", protect, agencyOnly, acceptAgencyDriverRequest);
router.patch("/drivers/:id/reject", protect, agencyOnly, rejectAgencyDriverRequest);
router.patch("/drivers/:id/documents", protect, agencyOnly, updateAgencyDriverDocuments);
router.get("/vehicles", protect, agencyOnly, getAgencyVehicles);
router.post("/vehicles", protect, agencyOnly, handleUploadArray("photos", 4), createAgencyVehicle);
router.put("/vehicles/:id", protect, agencyOnly, handleUploadArray("photos", 4), updateAgencyVehicle);
router.patch("/vehicles/:id/driver", protect, agencyOnly, assignVehicleDriver);
router.get("/bookings", protect, agencyOnly, getAgencyBookings);
router.patch("/bookings/:id/assign", protect, agencyOnly, assignAgencyBooking);

export default router;
