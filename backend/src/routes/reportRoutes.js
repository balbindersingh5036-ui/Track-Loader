import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import {
  getDashboardSummary,
  getBookingAnalytics,
  getRevenueReport,
  getCustomerReport,
  getDriverReport,
  getVehicleReport,
  getPaymentReport,
  getRatingReport,
  getComplaintReport,
  exportBookings,
  exportPayments
} from "../controllers/reportController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/dashboard", getDashboardSummary);
router.get("/bookings", getBookingAnalytics);
router.get("/revenue", getRevenueReport);
router.get("/customers", getCustomerReport);
router.get("/drivers", getDriverReport);
router.get("/vehicles", getVehicleReport);
router.get("/payments", getPaymentReport);
router.get("/ratings", getRatingReport);
router.get("/complaints", getComplaintReport);
router.get("/bookings/export", exportBookings);
router.get("/payments/export", exportPayments);

export default router;
