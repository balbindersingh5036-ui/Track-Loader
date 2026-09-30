import express from "express";

import {
  getAdminVehicleById,
  getAdminVehicles,
  updateAdminVehicle,
  updateAdminVehicleStatus
} from "../controllers/vehicleController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminVehicles);
router.get("/:id", getAdminVehicleById);
router.put("/:id", updateAdminVehicle);
router.patch("/:id/status", updateAdminVehicleStatus);

export default router;
