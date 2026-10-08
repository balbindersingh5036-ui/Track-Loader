import express from "express";
import {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner
} from "../controllers/bannerController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Public/Mobile route to get active banners based on query filters
router.get("/", getActiveBanners);

// Admin-only routes
router.use(protect, adminOnly);
router.get("/admin", getAllBanners);
router.get("/:id", getBannerById);
router.post("/", createBanner);
router.patch("/:id", updateBanner);
router.delete("/:id", deleteBanner);

export default router;
