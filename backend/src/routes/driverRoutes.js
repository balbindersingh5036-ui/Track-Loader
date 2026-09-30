import express from "express";

import Driver from "../models/Driver.js";

import {
  protect
} from "../middleware/authMiddleware.js";

import {
  driverOnly
} from "../middleware/driverMiddleware.js";

import {
  createDriverVehicle,
  getDriverVehicles,
  updateDriverVehicle,
  updateDriverVehicleStatus
} from "../controllers/vehicleController.js";

import {
  getDriverRequests,
  getDriverBookings,
  acceptBooking,
  rejectBooking,
  startTrip,
  completeTrip
} from "../controllers/bookingController.js";

const router = express.Router();

router.get("/vehicles", protect, driverOnly, getDriverVehicles);
router.post("/vehicles", protect, driverOnly, createDriverVehicle);
router.put("/vehicles/:id", protect, driverOnly, updateDriverVehicle);
router.patch(
  "/vehicles/:id/status",
  protect,
  driverOnly,
  updateDriverVehicleStatus
);

// Driver Booking Routes
router.get("/bookings/requests", protect, driverOnly, getDriverRequests);
router.get("/bookings/my", protect, driverOnly, getDriverBookings);
router.patch("/bookings/:id/accept", protect, driverOnly, acceptBooking);
router.patch("/bookings/:id/reject", protect, driverOnly, rejectBooking);
router.patch("/bookings/:id/start", protect, driverOnly, startTrip);
router.patch("/bookings/:id/complete", protect, driverOnly, completeTrip);

router.patch("/status", protect, driverOnly, async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isOnline must be a boolean"
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { isOnline },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: { isOnline: driver.isOnline }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update driver status"
    });
  }
});

router.get("/profile", protect, driverOnly, async (req, res) => {
  try {
    const driver = await Driver.findOne({
      user: req.user._id
    }).populate(
      "user",
      "name phone email profileImage role"
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Driver profile fetched successfully",
      data: {
        driver
      }
    });
  } catch (error) {
    console.error("Driver profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch driver profile"
    });
  }
});

export default router;