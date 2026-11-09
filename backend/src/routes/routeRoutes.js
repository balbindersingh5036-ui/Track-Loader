import express from "express";
import { calculateDistance } from "../controllers/routeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { routeRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Authenticated and rate-limited route distance calculation
router.post("/calculate-distance", protect, routeRateLimiter, calculateDistance);

export default router;

