import express from "express";
import { refundPayment } from "../controllers/paymentController.js";
import { getAdminPaymentById, getAdminPayments } from "../controllers/adminPaymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminPayments);
router.get("/:id", getAdminPaymentById);
router.post("/:paymentId/refund", refundPayment);

export default router;
