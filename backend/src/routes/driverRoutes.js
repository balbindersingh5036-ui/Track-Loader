import express from "express";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Agency from "../models/Agency.js";
import Vehicle from "../models/Vehicle.js";

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
import { sanitizeDriverDocumentResponse } from "../utils/driverDocumentResponse.js";
import { checkDriverOnlineEligibility } from "../utils/driverEligibility.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";

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

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    if (isOnline) {
      const agency = driver.agency ? await Agency.findById(driver.agency) : null;
      const vehicles = await Vehicle.find({ driver: driver._id, isActive: true, isAvailable: true });
      const eligibility = checkDriverOnlineEligibility(driver, vehicles, agency);
      if (!eligibility.eligible) {
        return res.status(403).json({
          success: false,
          message: eligibility.message
        });
      }
    }

    driver.isOnline = isOnline;
    await driver.save();

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

router.patch("/agency-request", protect, driverOnly, async (req, res) => {
  try {
    const { agencyId } = req.body;
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    if (agencyId) {
      if (!mongoose.Types.ObjectId.isValid(agencyId)) {
        return res.status(400).json({
          success: false,
          message: "A valid agency must be selected"
        });
      }

      const agency = await Agency.findOne({
        _id: agencyId,
        approvalStatus: "approved",
        isActive: true
      });

      if (!agency) {
        return res.status(400).json({
          success: false,
          message: "The selected agency is unavailable. Refresh the agency list and try again."
        });
      }

      driver.agency = agency._id;
      driver.agencyAssociation = {
        status: "pending",
        rejectionReason: "",
        decidedAt: null,
        decisionAt: null,
        reviewedBy: null
      };
    } else {
      driver.agency = null;
      driver.agencyAssociation = {
        status: "none",
        rejectionReason: "",
        decidedAt: null,
        decisionAt: null,
        reviewedBy: null
      };
    }

    await driver.save();

    const populated = await Driver.findById(driver._id)
      .populate("user", "name phone email profileImage role")
      .populate("agency", "agencyName phone email address city approvalStatus isActive");

    const driverObj = populated.toObject();
    sanitizeDriverDocumentResponse(driverObj, { includeSignedUrls: true });

    return res.status(200).json({
      success: true,
      message: agencyId ? "Agency association requested successfully and pending review" : "Switched to independent driver successfully",
      data: { driver: driverObj }
    });
  } catch (error) {
    console.error("Agency request error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request agency association"
    });
  }
});

export const getDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findOne({
      user: req.user._id
    })
      .populate("user", "name phone email profileImage role")
      .populate("agency", "agencyName phone email address city approvalStatus isActive");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found"
      });
    }

    const vehicles = await Vehicle.find({ driver: driver._id })
      .select("vehicleNumber vehicleModel vehicleType agency isActive isAvailable documents.registration documents.insurance")
      .sort({ createdAt: -1 })
      .lean();
    const driverObj = driver.toObject();
    sanitizeDriverDocumentResponse(driverObj, { includeSignedUrls: true });
    const safeVehicles = vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle));

    return res.status(200).json({
      success: true,
      message: "Driver profile fetched successfully",
      data: {
        driver: { ...driverObj, vehicles: safeVehicles }
      }
    });
  } catch (error) {
    console.error("Driver profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch driver profile"
    });
  }
};

router.get("/profile", protect, driverOnly, getDriverProfile);

export default router;
