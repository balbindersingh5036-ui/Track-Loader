import express from "express";
import {
  adminGetBookings,
  adminGetBookingById,
  adminUpdateBookingStatus,
  adminAssignDriver
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/", protect, adminOnly, adminGetBookings);
router.get("/:id", protect, adminOnly, adminGetBookingById);
router.patch("/:id/status", protect, adminOnly, adminUpdateBookingStatus);
router.patch("/:id/assign-driver", protect, adminOnly, adminAssignDriver);

export default router;
