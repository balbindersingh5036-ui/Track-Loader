import express from "express";
import { getAdminDriverEarnings } from "../controllers/driverEarningsController.js";
import { adminOnly } from "../middleware/adminMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", getAdminDriverEarnings);

export default router;
