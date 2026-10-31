import mongoose from "mongoose";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

const customerFields = "name phone email profileImage role isActive createdAt lastLoginAt";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeCustomer = (customer) => ({
  id: customer._id,
  name: customer.name,
  phone: customer.phone,
  email: customer.email || "",
  profileImage: customer.profileImage || "",
  role: customer.role,
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  lastLoginAt: customer.lastLoginAt
});

const parseCustomerFilters = (query) => {
  const dateFilter = {};
  for (const key of ["from", "to"]) {
    const value = query[key];
    if (value !== undefined) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${key} must use YYYY-MM-DD format`);
      }
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${key} must be a valid calendar date`);
      }
      dateFilter[key] = date;
    }
  }
  if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
    throw new Error("Start date must be on or before end date");
  }
  const createdAt = {};
  if (dateFilter.from) createdAt.$gte = dateFilter.from;
  if (dateFilter.to) {
    const end = new Date(dateFilter.to);
    end.setUTCDate(end.getUTCDate() + 1);
    createdAt.$lt = end;
  }
  return createdAt;
};

const customerExists = async (id) => User.exists({ _id: id, role: "customer" });

export const getAdminCustomers = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const query = { role: "customer" };
    if (req.query.isActive !== undefined) {
      if (!["true", "false"].includes(req.query.isActive)) {
        return errorResponse(res, "isActive must be true or false", 400);
      }
      query.isActive = req.query.isActive === "true";
    }
    if (req.query.hasBookings !== undefined) {
      if (!["true", "false"].includes(req.query.hasBookings)) {
        return errorResponse(res, "hasBookings must be true or false", 400);
      }
      const customersWithBookings = await Booking.distinct("customer");
      query._id = req.query.hasBookings === "true"
        ? { $in: customersWithBookings }
        : { $nin: customersWithBookings };
    }
    try {
      const createdAt = parseCustomerFilters(req.query);
      if (Object.keys(createdAt).length) query.createdAt = createdAt;
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    if (req.query.recentlyRegistered !== undefined) {
      if (req.query.recentlyRegistered !== "true") {
        return errorResponse(res, "recentlyRegistered must be true when provided", 400);
      }
      const recentStart = new Date();
      recentStart.setUTCDate(recentStart.getUTCDate() - 30);
      const recentCondition = { createdAt: { $gte: recentStart } };
      if (query.createdAt) {
        query.$and = [{ createdAt: query.createdAt }, recentCondition];
        delete query.createdAt;
      } else {
        query.createdAt = recentCondition.createdAt;
      }
    }
    if (req.query.search !== undefined) {
      if (typeof req.query.search !== "string" || req.query.search.length > 100) {
        return errorResponse(res, "search must be a string of 100 characters or fewer", 400);
      }
      const term = req.query.search.trim();
      if (term) {
        const search = new RegExp(escapeRegex(term), "i");
        const conditions = [{ name: search }, { phone: search }, { email: search }];
        if (mongoose.isValidObjectId(term)) conditions.push({ _id: term });
        query.$or = conditions;
      }
    }
    const sortFields = { createdAt: "createdAt", name: "name", lastLoginAt: "lastLoginAt" };
    const sortBy = req.query.sortBy ?? "createdAt";
    const sortOrder = req.query.sortOrder ?? "desc";
    if (!Object.hasOwn(sortFields, sortBy) || !["asc", "desc"].includes(sortOrder)) {
      return errorResponse(res, "Invalid customer sort option", 400);
    }

    const now = new Date();
    const recentRegistrationStart = new Date(now);
    recentRegistrationStart.setUTCDate(recentRegistrationStart.getUTCDate() - 30);
    const [
      customers,
      total,
      totalCustomers,
      activeCustomers,
      recentlyRegistered,
      customersWithBookings
    ] = await Promise.all([
      User.find(query)
        .select(customerFields)
        .sort({ [sortFields[sortBy]]: sortOrder === "asc" ? 1 : -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", isActive: true }),
      User.countDocuments({ role: "customer", createdAt: { $gte: recentRegistrationStart } }),
      Booking.distinct("customer")
    ]);
    const customerIds = customers.map(({ _id }) => _id);
    const [pageBookingCounts, customersWithBookingsCount] = await Promise.all([
      customerIds.length
        ? Booking.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: "$customer", count: { $sum: 1 } } }
        ])
        : [],
      customersWithBookings.length
        ? User.countDocuments({ role: "customer", _id: { $in: customersWithBookings } })
        : 0
    ]);
    const bookingCountByCustomer = new Map(
      pageBookingCounts.map(({ _id, count }) => [String(_id), count])
    );

    return successResponse(res, {
      customers: customers.map((customer) => ({
        ...safeCustomer(customer),
        bookingCount: bookingCountByCustomer.get(String(customer._id)) || 0
      })),
      stats: {
        total: totalCustomers,
        active: activeCustomers,
        inactive: totalCustomers - activeCustomers,
        recentlyRegistered,
        withBookings: customersWithBookingsCount,
        withoutBookings: totalCustomers - customersWithBookingsCount
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Customers fetched");
  } catch (error) {
    console.error("Admin customer list error:", error);
    return errorResponse(res, "Failed to fetch customers", 500);
  }
};

export const getAdminCustomerById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid customer ID", 400);
    }
    const customer = await User.findOne({ _id: req.params.id, role: "customer" })
      .select(customerFields)
      .lean();
    if (!customer) return errorResponse(res, "Customer not found", 404);
    const [bookingStatuses, paymentSummary] = await Promise.all([
      Booking.aggregate([
        { $match: { customer: customer._id } },
        {
          $group: {
            _id: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$bookingStatus", "rejected"] },
                    { $eq: ["$assignmentStatus", "rejected"] }
                  ]
                },
                "rejected",
                "$bookingStatus"
              ]
            },
            count: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        { $match: { customer: customer._id } },
        {
          $group: {
            _id: null,
            totalNetPaid: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["success", "refunded"]] },
                  { $subtract: ["$amount", { $ifNull: ["$refundAmount", 0] }] },
                  0
                ]
              }
            }
          }
        }
      ])
    ]);
    const bookingStats = bookingStatuses.reduce((stats, item) => {
      stats.total += item.count;
      if (Object.hasOwn(stats, item._id)) stats[item._id] = item.count;
      return stats;
    }, { total: 0, pending: 0, accepted: 0, rejected: 0, inProgress: 0, completed: 0, cancelled: 0 });
    const statusCounts = Object.fromEntries(bookingStatuses.map(({ _id, count }) => [_id, count]));
    bookingStats.pending = statusCounts.pending || 0;
    bookingStats.accepted = statusCounts.accepted || 0;
    bookingStats.rejected = statusCounts.rejected || 0;
    bookingStats.inProgress = statusCounts["in-progress"] || 0;
    bookingStats.completed = statusCounts.completed || 0;
    bookingStats.cancelled = statusCounts.cancelled || 0;
    return successResponse(res, {
      customer: safeCustomer(customer),
      stats: {
        bookings: bookingStats,
        totalNetPaid: paymentSummary[0]?.totalNetPaid ?? null
      }
    }, "Customer fetched");
  } catch (error) {
    console.error("Admin customer detail error:", error);
    return errorResponse(res, "Failed to fetch customer", 500);
  }
};

export const getAdminCustomerBookings = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid customer ID", 400);
    if (!(await customerExists(req.params.id))) return errorResponse(res, "Customer not found", 404);
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const query = { customer: req.params.id };
    if (req.query.bookingStatus !== undefined) {
      const allowedStatuses = ["pending", "accepted", "rejected", "cancelled", "in-progress", "completed"];
      if (!allowedStatuses.includes(req.query.bookingStatus)) {
        return errorResponse(res, "Invalid booking status", 400);
      }
      if (req.query.bookingStatus === "rejected") {
        query.$or = [
          { bookingStatus: "rejected" },
          { assignmentStatus: "rejected" }
        ];
      } else {
        query.bookingStatus = req.query.bookingStatus;
      }
    }
    if (req.query.search !== undefined) {
      if (typeof req.query.search !== "string" || req.query.search.length > 100) {
        return errorResponse(res, "search must be a string of 100 characters or fewer", 400);
      }
      if (req.query.search.trim()) {
        query.bookingId = new RegExp(escapeRegex(req.query.search.trim()), "i");
      }
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("agency", "agencyName")
        .populate("driver", "fullName")
        .populate("vehicle", "vehicleNumber")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Booking.countDocuments(query)
    ]);
    return successResponse(res, {
      bookings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Customer bookings fetched");
  } catch (error) {
    console.error("Admin customer bookings error:", error);
    return errorResponse(res, "Failed to fetch customer bookings", 500);
  }
};

export const getAdminCustomerPayments = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid customer ID", 400);
    if (!(await customerExists(req.params.id))) return errorResponse(res, "Customer not found", 404);
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    const query = { customer: req.params.id };
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("booking", "bookingId")
        .select("booking amount method provider orderId transactionId status paidAt refundAmount refundId refundedAt createdAt")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Payment.countDocuments(query)
    ]);
    return successResponse(res, {
      payments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Customer payments fetched");
  } catch (error) {
    console.error("Admin customer payments error:", error);
    return errorResponse(res, "Failed to fetch customer payments", 500);
  }
};

export const updateAdminCustomerStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return errorResponse(res, "Invalid customer ID", 400);
    }
    if (typeof req.body?.isActive !== "boolean" || Object.keys(req.body).some((key) => key !== "isActive")) {
      return errorResponse(res, "Only a boolean isActive value may be updated", 400);
    }

    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: "customer" },
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true }
    ).select(customerFields);
    if (!customer) return errorResponse(res, "Customer not found", 404);
    return successResponse(res, { customer: safeCustomer(customer) }, "Customer status updated");
  } catch (error) {
    console.error("Admin customer status update error:", error);
    return errorResponse(res, "Failed to update customer status", 500);
  }
};
