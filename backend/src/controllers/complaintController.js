import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Complaint from "../models/Complaint.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

const complaintStatuses = ["open", "in-review", "resolved", "closed"];
const statusTransitions = {
  open: ["in-review", "closed"],
  "in-review": ["open", "resolved", "closed"],
  resolved: ["closed"],
  closed: []
};

const populateComplaint = (query) => query
  .populate("raisedBy", "name phone email")
  .populate("booking", "bookingId");

export const createComplaint = async (req, res) => {
  try {
    const { bookingId, subject, description } = req.body || {};
    if (typeof subject !== "string" || !subject.trim() || subject.trim().length > 200) {
      return errorResponse(res, "subject is required and must be at most 200 characters", 400);
    }
    if (typeof description !== "string" || !description.trim() || description.trim().length > 2000) {
      return errorResponse(res, "description is required and must be at most 2000 characters", 400);
    }
    if (Object.keys(req.body || {}).some((key) => !["bookingId", "subject", "description"].includes(key))) {
      return errorResponse(res, "Unsupported complaint field", 400);
    }

    let booking = null;
    if (bookingId !== undefined && bookingId !== null && bookingId !== "") {
      if (typeof bookingId !== "string") return errorResponse(res, "Invalid booking ID", 400);
      booking = await Booking.findOne({
        $or: [
          ...(mongoose.isValidObjectId(bookingId) ? [{ _id: bookingId }] : []),
          { bookingId: bookingId.trim() }
        ],
        customer: req.user._id
      }).select("_id");
      if (!booking) return errorResponse(res, "Booking not found", 404);
    }

    const complaint = await Complaint.create({
      raisedBy: req.user._id,
      booking: booking?._id || null,
      subject: subject.trim(),
      description: description.trim()
    });
    return successResponse(res, { complaint }, "Complaint submitted", 201);
  } catch (error) {
    console.error("Create complaint error:", error);
    return errorResponse(res, "Failed to submit complaint", 500);
  }
};

export const getMyComplaints = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    const query = { raisedBy: req.user._id };
    const [complaints, total] = await Promise.all([
      populateComplaint(Complaint.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit)),
      Complaint.countDocuments(query)
    ]);
    return successResponse(res, {
      complaints,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Complaints fetched");
  } catch (error) {
    console.error("Customer complaint list error:", error);
    return errorResponse(res, "Failed to fetch complaints", 500);
  }
};

export const getMyComplaintById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid complaint ID", 400);
    const complaint = await populateComplaint(Complaint.findOne({
      _id: req.params.id,
      raisedBy: req.user._id
    }));
    if (!complaint) return errorResponse(res, "Complaint not found", 404);
    return successResponse(res, { complaint }, "Complaint fetched");
  } catch (error) {
    console.error("Customer complaint detail error:", error);
    return errorResponse(res, "Failed to fetch complaint", 500);
  }
};

export const getAdminComplaints = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    const query = {};
    if (req.query.status !== undefined) {
      if (!complaintStatuses.includes(req.query.status)) return errorResponse(res, "Invalid complaint status", 400);
      query.status = req.query.status;
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const regex = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingBookings = await Booking.find({ bookingId: regex }).select("_id").lean();
      query.$or = [
        { subject: regex },
        { booking: { $in: matchingBookings.map((booking) => booking._id) } }
      ];
    }
    const [complaints, total] = await Promise.all([
      populateComplaint(Complaint.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit)),
      Complaint.countDocuments(query)
    ]);
    return successResponse(res, {
      complaints,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Complaints fetched");
  } catch (error) {
    console.error("Admin complaint list error:", error);
    return errorResponse(res, "Failed to fetch complaints", 500);
  }
};

export const getAdminComplaintById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid complaint ID", 400);
    const complaint = await populateComplaint(Complaint.findById(req.params.id));
    if (!complaint) return errorResponse(res, "Complaint not found", 404);
    return successResponse(res, { complaint }, "Complaint fetched");
  } catch (error) {
    console.error("Admin complaint detail error:", error);
    return errorResponse(res, "Failed to fetch complaint", 500);
  }
};

export const updateAdminComplaintStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid complaint ID", 400);
    const { status } = req.body || {};
    if (!complaintStatuses.includes(status) || Object.keys(req.body || {}).some((key) => key !== "status")) {
      return errorResponse(res, "Invalid complaint status update", 400);
    }
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return errorResponse(res, "Complaint not found", 404);
    if (status !== complaint.status && !statusTransitions[complaint.status].includes(status)) {
      return errorResponse(res, `Cannot transition complaint from ${complaint.status} to ${status}`, 400);
    }
    complaint.status = status;
    complaint.resolvedAt = ["resolved", "closed"].includes(status)
      ? complaint.resolvedAt || new Date()
      : null;
    await complaint.save();
    await complaint.populate([
      { path: "raisedBy", select: "name phone email" },
      { path: "booking", select: "bookingId" }
    ]);
    return successResponse(res, { complaint }, "Complaint status updated");
  } catch (error) {
    console.error("Admin complaint status update error:", error);
    return errorResponse(res, "Failed to update complaint status", 500);
  }
};

export const updateAdminComplaintResponse = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid complaint ID", 400);
    const { response } = req.body || {};
    if (typeof response !== "string" || !response.trim() || response.trim().length > 2000 ||
      Object.keys(req.body || {}).some((key) => key !== "response")) {
      return errorResponse(res, "response is required and must be at most 2000 characters", 400);
    }
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: { adminResponse: response.trim() } },
      { new: true, runValidators: true }
    );
    if (!complaint) return errorResponse(res, "Complaint not found", 404);
    await complaint.populate([
      { path: "raisedBy", select: "name phone email" },
      { path: "booking", select: "bookingId" }
    ]);
    return successResponse(res, { complaint }, "Complaint response saved");
  } catch (error) {
    console.error("Admin complaint response error:", error);
    return errorResponse(res, "Failed to save complaint response", 500);
  }
};
