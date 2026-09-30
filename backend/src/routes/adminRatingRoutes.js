import express from "express";
import { getAdminRatingById, getAdminRatings } from "../controllers/adminRatingController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminRatings);
router.get("/:id", getAdminRatingById);

export default router;
