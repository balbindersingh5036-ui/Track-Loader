import express from "express";
import {
  getAdminAgencies,
  getAdminAgencyById,
  approveAdminAgency,
  rejectAdminAgency,
  suspendAdminAgency
} from "../controllers/adminAgencyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/", getAdminAgencies);
router.get("/:id", getAdminAgencyById);
router.patch("/:id/approve", approveAdminAgency);
router.patch("/:id/reject", rejectAdminAgency);
router.patch("/:id/suspend", suspendAdminAgency);

export default router;
