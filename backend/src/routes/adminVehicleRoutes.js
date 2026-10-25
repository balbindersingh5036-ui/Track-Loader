import express from "express";

import {
  getAdminVehicleById,
  getAdminVehicles,
  reviewAdminVehicleDocument,
  updateAdminVehicle,
  updateAdminVehicleStatus
} from "../controllers/vehicleController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { superAdminOnly } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminVehicles);
router.get("/:id", getAdminVehicleById);
router.patch("/:id/documents/:docType/:action", superAdminOnly, reviewAdminVehicleDocument);
router.put("/:id", updateAdminVehicle);
router.patch("/:id/status", updateAdminVehicleStatus);

export default router;
