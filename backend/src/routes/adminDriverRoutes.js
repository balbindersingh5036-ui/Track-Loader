import express from "express";
import {
  approveAdminDriver,
  getAdminDriverById,
  getAdminDrivers,
  rejectAdminDriver,
  suspendAdminDriver,
  updateAdminDriverStatus
} from "../controllers/adminDriverController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminDrivers);
router.get("/:id", getAdminDriverById);
router.patch("/:id/approve", approveAdminDriver);
router.patch("/:id/reject", rejectAdminDriver);
router.patch("/:id/suspend", suspendAdminDriver);
router.patch("/:id/status", updateAdminDriverStatus);

export default router;
