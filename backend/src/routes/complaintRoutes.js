import express from "express";
import {
  createComplaint,
  getMyComplaintById,
  getMyComplaints
} from "../controllers/complaintController.js";
import { protect } from "../middleware/authMiddleware.js";
import { customerOnly } from "../middleware/customerMiddleware.js";

const router = express.Router();

router.use(protect, customerOnly);
router.post("/", createComplaint);
router.get("/my", getMyComplaints);
router.get("/:id", getMyComplaintById);

export default router;
