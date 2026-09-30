import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import Rating from "../models/Rating.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { parseDateRange } from "../utils/dateParser.js";

const populateRating = (query) => query
  .populate("customer", "name phone email")
  .populate("driver", "fullName phone rating totalTrips");

const getDateMatch = (req) => {
  const from = req.query.from;
  const to = req.query.to;
  if ((from !== undefined && typeof from !== "string") || (to !== undefined && typeof to !== "string")) {
    throw new Error("from and to must be valid date strings");
  }
  const range = parseDateRange(from, to);
  if ((from && !range.from) || (to && !range.to)) {
    throw new Error("from and to must be valid date strings");
  }
  return range.match;
};

export const createRating = async (req, res) => {
  try {
    const { bookingId, rating, feedback = "" } = req.body || {};
    if (!mongoose.isValidObjectId(bookingId)) return errorResponse(res, "Invalid booking ID", 400);
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return errorResponse(res, "rating must be an integer from 1 to 5", 400);
    }
    if (typeof feedback !== "string" || feedback.length > 1000) {
      return errorResponse(res, "feedback must be a string of at most 1000 characters", 400);
    }
    if (Object.keys(req.body || {}).some((key) => !["bookingId", "rating", "feedback"].includes(key))) {
      return errorResponse(res, "Unsupported rating field", 400);
    }

    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking) return errorResponse(res, "Booking not found", 404);
    if (booking.bookingStatus !== "completed") {
      return errorResponse(res, "Only completed bookings can be rated", 400);
    }
    if (!booking.driver) return errorResponse(res, "This booking has no assigned driver to rate", 400);
    if (await Rating.exists({ booking: booking._id })) {
      return errorResponse(res, "This booking has already been rated", 409);
    }

    let newRating;
    try {
      newRating = await Rating.create({
        booking: booking._id,
        customer: req.user._id,
        driver: booking.driver,
        rating,
        feedback: feedback.trim()
      });
    } catch (error) {
      if (error?.code === 11000) return errorResponse(res, "This booking has already been rated", 409);
      throw error;
    }

    await Driver.updateOne(
      { _id: booking.driver },
      [{
        $set: {
          ratingCount: { $add: [{ $ifNull: ["$ratingCount", 0] }, 1] },
          rating: {
            $divide: [
              {
                $add: [
                  {
                    $multiply: [
                      { $ifNull: ["$rating", 0] },
                      { $ifNull: ["$ratingCount", 0] }
                    ]
                  },
                  rating
                ]
              },
              { $add: [{ $ifNull: ["$ratingCount", 0] }, 1] }
            ]
          }
        }
      }]
    );

    await newRating.populate([
      { path: "customer", select: "name phone email" },
      { path: "driver", select: "fullName phone rating totalTrips" }
    ]);
    return successResponse(res, { rating: newRating }, "Rating submitted", 201);
  } catch (error) {
    console.error("Create rating error:", error);
    return errorResponse(res, "Failed to submit rating", 500);
  }
};

export const getCustomerBookingRating = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.bookingId)) return errorResponse(res, "Invalid booking ID", 400);
    const booking = await Booking.findOne({
      _id: req.params.bookingId,
      customer: req.user._id
    }).select("_id");
    if (!booking) return errorResponse(res, "Booking not found", 404);
    const rating = await populateRating(Rating.findOne({ booking: booking._id }));
    if (!rating) return errorResponse(res, "Rating not found", 404);
    return successResponse(res, { rating }, "Rating fetched");
  } catch (error) {
    console.error("Customer booking rating error:", error);
    return errorResponse(res, "Failed to fetch rating", 500);
  }
};

export const getAdminRatings = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    const query = {};
    if (req.query.rating !== undefined) {
      if (typeof req.query.rating !== "string") {
        return errorResponse(res, "rating must be an integer from 1 to 5", 400);
      }
      const rating = Number(req.query.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return errorResponse(res, "rating must be an integer from 1 to 5", 400);
      }
      query.rating = rating;
    }
    if (req.query.driver !== undefined) {
      if (typeof req.query.driver !== "string" || !mongoose.isValidObjectId(req.query.driver)) {
        return errorResponse(res, "Invalid driver ID", 400);
      }
      query.driver = req.query.driver;
    }
    try {
      const dateMatch = getDateMatch(req);
      if (Object.keys(dateMatch).length) query.createdAt = dateMatch;
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const [ratings, total] = await Promise.all([
      populateRating(Rating.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit)),
      Rating.countDocuments(query)
    ]);
    return successResponse(res, {
      ratings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Ratings fetched");
  } catch (error) {
    console.error("Admin rating list error:", error);
    return errorResponse(res, "Failed to fetch ratings", 500);
  }
};

export const getAdminRatingById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid rating ID", 400);
    const rating = await populateRating(Rating.findById(req.params.id));
    if (!rating) return errorResponse(res, "Rating not found", 404);
    return successResponse(res, { rating }, "Rating fetched");
  } catch (error) {
    console.error("Admin rating detail error:", error);
    return errorResponse(res, "Failed to fetch rating", 500);
  }
};
