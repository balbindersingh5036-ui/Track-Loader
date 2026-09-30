import express from "express";
import {
  getAdminComplaintById,
  getAdminComplaints,
  updateAdminComplaintResponse,
  updateAdminComplaintStatus
} from "../controllers/adminComplaintController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminComplaints);
router.get("/:id", getAdminComplaintById);
router.patch("/:id/status", updateAdminComplaintStatus);
router.patch("/:id/response", updateAdminComplaintResponse);

export default router;
