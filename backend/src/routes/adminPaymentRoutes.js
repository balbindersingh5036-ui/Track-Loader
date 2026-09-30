import express from "express";
import { refundPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/:paymentId/refund", protect, adminOnly, refundPayment);

export default router;
