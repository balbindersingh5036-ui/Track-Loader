import express from "express";
import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { customerOnly } from "../middleware/customerMiddleware.js";

const router = express.Router();

router.post("/", protect, customerOnly, createBooking);
router.get("/my", protect, customerOnly, getMyBookings);
router.get("/:id", protect, getBookingById); // Open to customer, driver, admin (handled in controller)
router.patch("/:id/cancel", protect, customerOnly, cancelBooking);

export default router;
