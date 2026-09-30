import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { parseDateRange } from "../utils/dateParser.js";

const parseRequestedDateRange = (query) => {
  if ((query.from !== undefined && typeof query.from !== "string") ||
      (query.to !== undefined && typeof query.to !== "string")) {
    throw new Error("from and to must be valid date strings");
  }
  const range = parseDateRange(query.from, query.to);
  if ((query.from && !range.from) || (query.to && !range.to)) {
    throw new Error("from and to must be valid date strings");
  }
  return range.match;
};

const earningsFor = async (match) => {
  const [summary] = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        completedTrips: { $sum: 1 },
        totalEarnings: { $sum: "$finalFare" }
      }
    }
  ]);
  return {
    completedTrips: summary?.completedTrips || 0,
    totalEarnings: summary?.totalEarnings || 0
  };
};

const earningsDates = (dateMatch) => Object.keys(dateMatch).length
  ? { completedAt: dateMatch }
  : {};

export const getDriverEarnings = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id }).select("_id");
    if (!driver) return errorResponse(res, "Driver profile not found", 404);

    if (req.query.driverId !== undefined &&
      (typeof req.query.driverId !== "string" ||
        !mongoose.isValidObjectId(req.query.driverId) ||
        req.query.driverId !== driver._id.toString())) {
      return errorResponse(res, "Drivers may only access their own earnings", 403);
    }

    let pagination;
    let dateMatch;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
      dateMatch = parseRequestedDateRange(req.query);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const baseMatch = { driver: driver._id, bookingStatus: "completed" };
    const dateFilter = earningsDates(dateMatch);
    const filteredMatch = { ...baseMatch, ...dateFilter };
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [summary, currentPeriod, earnings, total] = await Promise.all([
      earningsFor(filteredMatch),
      earningsFor({
        ...baseMatch,
        completedAt: { $gte: periodStart, $lte: now }
      }),
      Booking.find(filteredMatch)
        .select("bookingId completedAt finalFare estimatedFare paymentStatus vehicleType")
        .sort({ completedAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Booking.countDocuments(filteredMatch)
    ]);

    return successResponse(res, {
      totalTrips: summary.completedTrips,
      completedTrips: summary.completedTrips,
      totalEarnings: summary.totalEarnings,
      currentPeriodEarnings: currentPeriod.totalEarnings,
      earnings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Driver earnings fetched");
  } catch (error) {
    console.error("Driver earnings error:", error);
    return errorResponse(res, "Failed to fetch driver earnings", 500);
  }
};

export const getDriverEarningsSummary = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id }).select("_id");
    if (!driver) return errorResponse(res, "Driver profile not found", 404);
    if (req.query.driverId !== undefined &&
      (typeof req.query.driverId !== "string" ||
        !mongoose.isValidObjectId(req.query.driverId) ||
        req.query.driverId !== driver._id.toString())) {
      return errorResponse(res, "Drivers may only access their own earnings", 403);
    }

    let dateMatch;
    try {
      dateMatch = parseRequestedDateRange(req.query);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const baseMatch = { driver: driver._id, bookingStatus: "completed" };
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [summary, currentPeriod] = await Promise.all([
      earningsFor({ ...baseMatch, ...earningsDates(dateMatch) }),
      earningsFor({ ...baseMatch, completedAt: { $gte: periodStart, $lte: now } })
    ]);

    return successResponse(res, {
      totalTrips: summary.completedTrips,
      completedTrips: summary.completedTrips,
      totalEarnings: summary.totalEarnings,
      currentPeriodEarnings: currentPeriod.totalEarnings
    }, "Driver earnings summary fetched");
  } catch (error) {
    console.error("Driver earnings summary error:", error);
    return errorResponse(res, "Failed to fetch driver earnings summary", 500);
  }
};

export const getAdminDriverEarnings = async (req, res) => {
  try {
    let pagination;
    let dateMatch;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
      dateMatch = parseRequestedDateRange(req.query);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const match = { bookingStatus: "completed", ...earningsDates(dateMatch) };
    if (req.query.driverId !== undefined) {
      if (typeof req.query.driverId !== "string" || !mongoose.isValidObjectId(req.query.driverId)) {
        return errorResponse(res, "Invalid driver ID", 400);
      }
      if (!await Driver.exists({ _id: req.query.driverId })) return errorResponse(res, "Driver not found", 404);
      match.driver = new mongoose.Types.ObjectId(req.query.driverId);
    }

    const [summary, earnings, total] = await Promise.all([
      earningsFor(match),
      Booking.find(match)
        .select("bookingId driver completedAt finalFare estimatedFare paymentStatus vehicleType")
        .populate({
          path: "driver",
          select: "fullName phone user",
          populate: { path: "user", select: "name email" }
        })
        .sort({ completedAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Booking.countDocuments(match)
    ]);

    return successResponse(res, {
      ...summary,
      earnings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Driver earnings report fetched");
  } catch (error) {
    console.error("Admin driver earnings error:", error);
    return errorResponse(res, "Failed to fetch driver earnings", 500);
  }
};
