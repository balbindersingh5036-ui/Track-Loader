import express from "express";

import {
  register,
  registerDriver,
  login,
  driverLogin,
  agencyLogin,
  adminLogin,
  getMe
} from "../controllers/authController.js";

import {
  protect
} from "../middleware/authMiddleware.js";

const router = express.Router();

/* Customer */
router.post("/register", register);
router.post("/login", login);

/* Driver */
router.post("/driver/register", registerDriver);
router.post("/driver/login", driverLogin);
router.post("/agency/login", agencyLogin);

/* Admin */
router.post("/admin/login", adminLogin);
router.post("/adminlogin", adminLogin);

/* Logged-in user */
router.get("/me", protect, getMe);

export default router;