import express from "express";
import {
  getDriverEarnings,
  getDriverEarningsSummary
} from "../controllers/driverEarningsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { driverOnly } from "../middleware/driverMiddleware.js";

const router = express.Router();

router.use(protect, driverOnly);
router.get("/summary", getDriverEarningsSummary);
router.get("/", getDriverEarnings);

export default router;
