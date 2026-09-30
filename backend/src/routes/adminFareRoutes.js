import express from "express";
import {
  adminGetFares,
  adminGetFareById,
  adminCreateFare,
  adminUpdateFare,
  adminToggleFareStatus,
  adminDeleteFare
} from "../controllers/fareController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/", adminGetFares);
router.post("/", adminCreateFare);
router.get("/:id", adminGetFareById);
router.put("/:id", adminUpdateFare);
router.patch("/:id/status", adminToggleFareStatus);
router.delete("/:id", adminDeleteFare);

export default router;
