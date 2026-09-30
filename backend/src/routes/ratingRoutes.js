import express from "express";
import { createRating, getCustomerBookingRating } from "../controllers/ratingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { customerOnly } from "../middleware/customerMiddleware.js";

const router = express.Router();

router.use(protect, customerOnly);
router.post("/", createRating);
router.get("/booking/:bookingId", getCustomerBookingRating);

export default router;
