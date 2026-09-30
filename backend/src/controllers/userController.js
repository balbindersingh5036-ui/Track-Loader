import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { errorResponse, successResponse } from "../utils/response.js";

const profileFields = "name phone email profileImage role isActive createdAt";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const handleError = (res, error, action) => {
  console.error(`${action} error:`, error);

  if (error?.code === 11000) {
    return errorResponse(res, "Email address is already in use", 409);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return errorResponse(res, error.message, 400);
  }

  return errorResponse(res, `${action} failed`, 500);
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select(profileFields)
      .lean();

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(
      res,
      {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        profileImage: user.profileImage || "",
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      "Profile fetched successfully"
    );
  } catch (error) {
    return handleError(res, error, "Fetch profile");
  }
};

export const updateProfile = async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(res, "A profile object is required", 400);
    }

    const forbiddenFields = ["role", "isActive", "password", "_id", "id"];
    if (forbiddenFields.some((field) => Object.hasOwn(body, field))) {
      return errorResponse(
        res,
        "Role, account status, password and ID cannot be changed here",
        400
      );
    }

    const allowedFields = ["name", "email", "profileImage"];
    const unknownFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field)
    );
    if (unknownFields.length > 0) {
      return errorResponse(res, "Unsupported profile field", 400);
    }

    if (Object.keys(body).length === 0) {
      return errorResponse(res, "At least one profile field is required", 400);
    }

    const updates = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return errorResponse(res, "Name must be a non-empty string", 400);
      }
      updates.name = body.name.trim();
    }

    if (Object.hasOwn(body, "email")) {
      if (typeof body.email !== "string") {
        return errorResponse(res, "Email must be a string", 400);
      }
      const email = body.email.trim().toLowerCase();
      if (email && !emailPattern.test(email)) {
        return errorResponse(res, "Please provide a valid email address", 400);
      }
      updates.email = email;
    }

    if (Object.hasOwn(body, "profileImage")) {
      if (typeof body.profileImage !== "string") {
        return errorResponse(res, "Profile image must be a string", 400);
      }
      updates.profileImage = body.profileImage.trim();
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
      projection: profileFields
    }).lean();

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(
      res,
      {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        profileImage: user.profileImage || "",
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      "Profile updated successfully"
    );
  } catch (error) {
    return handleError(res, error, "Update profile");
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return errorResponse(
        res,
        "Current password and new password are required",
        400
      );
    }

    if (newPassword.length < 6) {
      return errorResponse(
        res,
        "New password must be at least 6 characters",
        400
      );
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const matches = await comparePassword(currentPassword, user.password);
    if (!matches) {
      return errorResponse(res, "Current password is incorrect", 400);
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return successResponse(res, null, "Password changed successfully");
  } catch (error) {
    return handleError(res, error, "Change password");
  }
};

export const getBookingsSummary = async (req, res) => {
  try {
    const customerId = req.user._id;
    const counts = await Booking.aggregate([
      { $match: { customer: customerId } },
      { $group: { _id: "$bookingStatus", count: { $sum: 1 } } }
    ]);
    const countByStatus = new Map(
      counts.map(({ _id, count }) => [_id, count])
    );

    return successResponse(
      res,
      {
        totalBookings: counts.reduce((total, { count }) => total + count, 0),
        pendingBookings: countByStatus.get("pending") || 0,
        acceptedBookings: countByStatus.get("accepted") || 0,
        inProgressBookings: countByStatus.get("in-progress") || 0,
        completedBookings: countByStatus.get("completed") || 0,
        cancelledBookings: countByStatus.get("cancelled") || 0
      },
      "Booking summary fetched successfully"
    );
  } catch (error) {
    return handleError(res, error, "Fetch booking summary");
  }
};
