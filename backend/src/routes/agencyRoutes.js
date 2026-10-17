import express from "express";
import {
  registerAgency,
  getMyAgency,
  updateMyAgency,
  getAgencyDrivers,
  createAgencyDriver,
  updateAgencyDriverDocuments,
  getAgencyVehicles,
  createAgencyVehicle,
  updateAgencyVehicle,
  assignVehicleDriver,
  getAgencyBookings
} from "../controllers/agencyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { agencyOnly } from "../middleware/agencyMiddleware.js";

const router = express.Router();

// Public agency registration (authenticated user applies to become agency owner)
router.post("/register", protect, registerAgency);

// Agency owner management routes
router.get("/profile", protect, agencyOnly, getMyAgency);
router.put("/profile", protect, agencyOnly, updateMyAgency);
router.get("/drivers", protect, agencyOnly, getAgencyDrivers);
router.post("/drivers", protect, agencyOnly, createAgencyDriver);
router.patch("/drivers/:id/documents", protect, agencyOnly, updateAgencyDriverDocuments);
router.get("/vehicles", protect, agencyOnly, getAgencyVehicles);
router.post("/vehicles", protect, agencyOnly, createAgencyVehicle);
router.put("/vehicles/:id", protect, agencyOnly, updateAgencyVehicle);
router.patch("/vehicles/:id/driver", protect, agencyOnly, assignVehicleDriver);
router.get("/bookings", protect, agencyOnly, getAgencyBookings);

export default router;
