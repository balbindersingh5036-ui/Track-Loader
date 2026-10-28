import express from "express";
import {
  getAdminAgencies,
  getAdminAgencyById,
  approveAdminAgency,
  rejectAdminAgency,
  suspendAdminAgency,
  reviewAdminAgencyDocument
} from "../controllers/adminAgencyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { superAdminOnly } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/", getAdminAgencies);
router.get("/:id", getAdminAgencyById);
router.patch("/:id/approve", superAdminOnly, approveAdminAgency);
router.patch("/:id/reject", superAdminOnly, rejectAdminAgency);
router.patch("/:id/suspend", superAdminOnly, suspendAdminAgency);
router.patch("/:id/documents/:docType/:action", superAdminOnly, reviewAdminAgencyDocument);

export default router;
