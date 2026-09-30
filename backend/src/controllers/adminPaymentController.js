import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

const paymentFields = "booking customer amount method provider transactionId orderId status paidAt refundId refundAmount refundedAt createdAt";

const safePayment = (payment) => ({
  paymentId: payment._id,
  bookingId: payment.booking?.bookingId || payment.booking?._id || payment.booking,
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
  createdAt: payment.createdAt
});

const buildPaymentQuery = async (query) => {
  const filter = {};
  for (const field of ["status", "method", "provider"]) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== "string" || !query[field].trim()) {
        throw new Error(`${field} must be a non-empty string`);
      }
      filter[field] = query[field].trim();
    }
  }

  const regexFields = ["transactionId", "orderId"];
  for (const field of regexFields) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== "string" || !query[field].trim()) {
        throw new Error(`${field} must be a non-empty string`);
      }
      filter[field] = new RegExp(query[field].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  }

  if (query.bookingId !== undefined) {
    if (typeof query.bookingId !== "string" || !query.bookingId.trim()) {
      throw new Error("bookingId must be a non-empty string");
    }
    const bookingRegex = new RegExp(query.bookingId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const bookings = await Booking.find({ bookingId: bookingRegex }).select("_id").lean();
    filter.booking = { $in: bookings.map((booking) => booking._id) };
  }
  return filter;
};

export const getAdminPayments = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }
    let query;
    try {
      query = await buildPaymentQuery(req.query);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .select(paymentFields)
        .populate("booking", "bookingId")
        .populate("customer", "name phone email")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Payment.countDocuments(query)
    ]);

    return successResponse(res, {
      payments: payments.map(safePayment),
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
      .populate("booking", "bookingId")
      .populate("customer", "name phone email")
      .lean();
    if (!payment) return errorResponse(res, "Payment not found", 404);
    return successResponse(res, { payment: safePayment(payment) }, "Payment fetched");
  } catch (error) {
    console.error("Admin payment detail error:", error);
    return errorResponse(res, "Failed to fetch payment", 500);
  }
};
