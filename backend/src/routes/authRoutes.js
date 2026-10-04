import express from "express";

import {
  register,
  login,
  driverLogin,
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
router.post("/driver/login", driverLogin);

/* Admin */
router.post("/admin/login", adminLogin);
router.post("/adminlogin", adminLogin);

/* Logged-in user */
router.get("/me", protect, getMe);

export default router;