import express from "express";
import {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  processWebhook
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { customerOnly } from "../middleware/customerMiddleware.js";

const router = express.Router();

router.post("/create-order", protect, customerOnly, createOrder);
router.post("/verify", protect, customerOnly, verifyPayment);
router.get("/:bookingId", protect, getPaymentStatus);

// Webhook handles its own signature verification, no JWT protect needed
router.post("/webhook", processWebhook);

export default router;
