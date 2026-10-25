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

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminDrivers);
router.get("/:id", getAdminDriverById);
router.patch("/:id/documents/:docType/:action", reviewAdminDriverDocument);
router.patch("/:id/approve", approveAdminDriver);
router.patch("/:id/reject", rejectAdminDriver);
router.patch("/:id/suspend", suspendAdminDriver);
router.patch("/:id/status", updateAdminDriverStatus);

export default router;
