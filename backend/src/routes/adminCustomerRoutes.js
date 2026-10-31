import express from "express";
import {
  getAdminCustomerById,
  getAdminCustomerBookings,
  getAdminCustomers,
  getAdminCustomerPayments,
  updateAdminCustomerStatus
} from "../controllers/adminCustomerController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminCustomers);
router.get("/:id/bookings", getAdminCustomerBookings);
router.get("/:id/payments", getAdminCustomerPayments);
router.get("/:id", getAdminCustomerById);
router.patch("/:id/status", updateAdminCustomerStatus);

export default router;
