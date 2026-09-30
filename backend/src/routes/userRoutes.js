import express from "express";

import {
  changePassword,
  getBookingsSummary,
  getProfile,
  updateProfile
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { customerOnly } from "../middleware/customerMiddleware.js";

const router = express.Router();

router.use(protect, customerOnly);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.get("/bookings-summary", getBookingsSummary);

export default router;
