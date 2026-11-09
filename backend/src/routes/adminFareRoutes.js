import express from "express";
import {
  adminGetFares,
  adminGetFareById,
  adminCreateFare,
  adminUpdateFare,
  adminToggleFareStatus,
  adminDeleteFare,
  getFareVehicleCategories
} from "../controllers/fareController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { superAdminPricingOnly } from "../middleware/superAdminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

// Read-only routes available to Admin role
router.get("/categories", getFareVehicleCategories);
router.get("/", adminGetFares);
router.get("/:id", adminGetFareById);

// Modification routes protected strictly by Super Admin authorization
router.post("/", superAdminPricingOnly, adminCreateFare);
router.put("/:id", superAdminPricingOnly, adminUpdateFare);
router.patch("/:id/status", superAdminPricingOnly, adminToggleFareStatus);
router.delete("/:id", superAdminPricingOnly, adminDeleteFare);

export default router;
