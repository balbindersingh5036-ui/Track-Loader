import express from "express";
import {
  approveAdminDriver,
  getAdminDriverById,
  getAdminDrivers,
  rejectAdminDriver,
  reviewAdminDriverDocument,
  suspendAdminDriver,
  updateAdminDriverStatus
} from "../controllers/adminDriverController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { superAdminOnly } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminDrivers);
router.get("/:id", getAdminDriverById);
router.patch("/:id/documents/:docType/:action", superAdminOnly, reviewAdminDriverDocument);
router.patch("/:id/approve", superAdminOnly, approveAdminDriver);
router.patch("/:id/reject", superAdminOnly, rejectAdminDriver);
router.patch("/:id/suspend", superAdminOnly, suspendAdminDriver);
router.patch("/:id/status", updateAdminDriverStatus);

export default router;
