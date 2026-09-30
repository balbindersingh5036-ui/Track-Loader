import express from "express";
import {
  getAdminCustomerById,
  getAdminCustomers,
  updateAdminCustomerStatus
} from "../controllers/adminCustomerController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminCustomers);
router.get("/:id", getAdminCustomerById);
router.patch("/:id/status", updateAdminCustomerStatus);

export default router;
