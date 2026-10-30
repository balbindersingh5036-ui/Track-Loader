import express from "express";
import {
  adminGetBookings,
  adminGetBookingById
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/", protect, adminOnly, adminGetBookings);
router.get("/:id", protect, adminOnly, adminGetBookingById);

export default router;
