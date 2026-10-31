import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

const paymentFields = "booking customer amount method provider transactionId orderId status paidAt refundId refundAmount refundStatus refundInitiatedAt refundedAt createdAt updatedAt";
const bookingFields = "bookingId pickup drop bookingMode vehicleType estimatedFare finalFare bookingStatus paymentStatus preferredPickupDate preferredPickupTime createdAt";
const paymentStatuses = ["pending", "success", "failed", "refunded"];
const paymentMethods = ["online", "cash"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safePayment = (payment) => {
  const booking = payment.booking && typeof payment.booking === "object"
    ? {
      id: payment.booking._id,
      bookingId: payment.booking.bookingId || "",
      pickup: payment.booking.pickup || null,
      drop: payment.booking.drop || null,
      bookingMode: payment.booking.bookingMode || "",
      vehicleType: payment.booking.vehicleType || "",
      estimatedFare: payment.booking.estimatedFare,
      finalFare: payment.booking.finalFare,
      bookingStatus: payment.booking.bookingStatus || "",
      paymentStatus: payment.booking.paymentStatus || "",
      preferredPickupDate: payment.booking.preferredPickupDate || null,
      preferredPickupTime: payment.booking.preferredPickupTime || "",
      createdAt: payment.booking.createdAt || null
    }
    : null;

  return {
    paymentId: payment._id,
    bookingId: booking?.bookingId || payment.booking?._id || payment.booking || null,
    booking,
    customer: payment.customer && typeof payment.customer === "object" ? {
      id: payment.customer._id,
      name: payment.customer.name,
      phone: payment.customer.phone,
      email: payment.customer.email || ""
    } : null,
    amount: payment.amount,
    method: payment.method,
    provider: payment.provider,
    transactionId: payment.transactionId,
    orderId: payment.orderId,
    status: payment.status,
    paidAt: payment.paidAt,
    refundId: payment.refundId,
    refundAmount: payment.refundAmount,
    refundedAt: payment.refundedAt,
    refundStatus: payment.refundStatus || null,
    refundInitiatedAt: payment.refundInitiatedAt,
    refundEligible: payment.status === "success" && Boolean(payment.transactionId) && !payment.refundId && !payment.refundStatus && !(payment.refundAmount > 0) && payment.amount > 0,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
};

const parseDateRange = (query) => {
  const range = {};
  for (const key of ["from", "to"]) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${key} must use YYYY-MM-DD format`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error(`${key} must be a valid calendar date`);
    }
    range[key] = date;
  }
  if (range.from && range.to && range.from > range.to) {
    throw new Error("Start date must be on or before end date");
  }
  const createdAt = {};
  if (range.from) createdAt.$gte = range.from;
  if (range.to) {
    const end = new Date(range.to);
    end.setUTCDate(end.getUTCDate() + 1);
    createdAt.$lt = end;
  }
  return createdAt;
};

const buildPaymentQuery = async (query) => {
  const filter = {};
  for (const [field, acceptedValues] of [["status", paymentStatuses], ["method", paymentMethods]]) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== "string" || !acceptedValues.includes(query[field])) {
        throw new Error(`Unsupported payment ${field}`);
      }
      filter[field] = query[field];
    }
  }
  if (query.provider !== undefined) {
    if (typeof query.provider !== "string" || !query.provider.trim() || query.provider.length > 80) {
      throw new Error("provider must be a non-empty string of 80 characters or fewer");
    }
    filter.provider = query.provider.trim();
  }
  for (const field of ["transactionId", "orderId"]) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== "string" || !query[field].trim() || query[field].length > 100) {
        throw new Error(`${field} must be a non-empty string of 100 characters or fewer`);
      }
      filter[field] = new RegExp(escapeRegex(query[field].trim()), "i");
    }
  }
  if (query.bookingId !== undefined) {
    if (typeof query.bookingId !== "string" || !query.bookingId.trim() || query.bookingId.length > 100) {
      throw new Error("bookingId must be a non-empty string of 100 characters or fewer");
    }
    const matches = await Booking.find({ bookingId: new RegExp(escapeRegex(query.bookingId.trim()), "i") }).select("_id").lean();
    filter.booking = { $in: matches.map(({ _id }) => _id) };
  }

  const createdAt = parseDateRange(query);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 100) {
      throw new Error("search must be a string of 100 characters or fewer");
    }
    const term = query.search.trim();
    if (term) {
      const search = new RegExp(escapeRegex(term), "i");
      const [bookings, customers] = await Promise.all([
        Booking.find({ bookingId: search }).select("_id").lean(),
        User.find({ $or: [{ name: search }, { phone: search }, { email: search }] }).select("_id").lean()
      ]);
      const conditions = [
        { transactionId: search },
        { orderId: search },
        { booking: { $in: bookings.map(({ _id }) => _id) } },
        { customer: { $in: customers.map(({ _id }) => _id) } },
        { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(term), options: "i" } } }
      ];
      if (mongoose.isValidObjectId(term)) conditions.push({ _id: new mongoose.Types.ObjectId(term) });
      filter.$or = conditions;
    }
  }

  const sortFields = { date: "createdAt", amount: "amount", status: "status" };
  const sortBy = query.sortBy ?? "date";
  const sortOrder = query.sortOrder ?? "desc";
  if (!Object.hasOwn(sortFields, sortBy) || !["asc", "desc"].includes(sortOrder)) {
    throw new Error("Invalid payment sort option");
  }
  return { filter, sort: { [sortFields[sortBy]]: sortOrder === "asc" ? 1 : -1, _id: -1 } };
};

const getPaymentSummary = async () => {
  const [result = {}] = await Payment.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        refunded: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] } },
        successfulAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "success"] },
              {
                $cond: [
                  { $eq: ["$refundStatus", "processed"] },
                  { $subtract: ["$amount", { $ifNull: ["$refundAmount", 0] }] },
                  "$amount"
                ]
              },
              0
            ]
          }
        },
        refundedAmount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", "refunded"] },
                  { $and: [{ $eq: ["$status", "success"] }, { $eq: ["$refundStatus", "processed"] }] }
                ]
              },
              { $ifNull: ["$refundAmount", 0] },
              0
            ]
          }
        }
      }
    }
  ]);
  return {
    total: result.total || 0,
    successful: result.successful || 0,
    pending: result.pending || 0,
    failed: result.failed || 0,
    refunded: result.refunded || 0,
    successfulAmount: result.successfulAmount || 0,
    refundedAmount: result.refundedAmount || 0
  };
};

export const getAdminPayments = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    let paymentQuery;
    try {
      paymentQuery = await buildPaymentQuery(req.query);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const [payments, total, summary, providers] = await Promise.all([
      Payment.find(paymentQuery.filter)
        .select(paymentFields)
        .populate("booking", bookingFields)
        .populate("customer", "name phone email")
        .sort(paymentQuery.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Payment.countDocuments(paymentQuery.filter),
      getPaymentSummary(),
      Payment.distinct("provider")
    ]);

    return successResponse(res, {
      payments: payments.map(safePayment),
      summary,
      facets: {
        statuses: paymentStatuses,
        methods: paymentMethods,
        providers: providers.filter(Boolean).sort()
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Payments fetched");
  } catch (error) {
    console.error("Admin payment list error:", error);
    return errorResponse(res, "Failed to fetch payments", 500);
  }
};

export const getAdminPaymentById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid payment ID", 400);
    const payment = await Payment.findById(req.params.id)
      .select(paymentFields)
      .populate("booking", bookingFields)
      .populate("customer", "name phone email")
      .lean();
    if (!payment) return errorResponse(res, "Payment not found", 404);
    return successResponse(res, { payment: safePayment(payment) }, "Payment fetched");
  } catch (error) {
    console.error("Admin payment detail error:", error);
    return errorResponse(res, "Failed to fetch payment", 500);
  }
};
