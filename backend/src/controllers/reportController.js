import User from "../models/User.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Rating from "../models/Rating.js";
import Complaint from "../models/Complaint.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { parseDateRange } from "../utils/dateParser.js";

const getPagination = (req) => {
  const pageValue = req.query.page;
  const limitValue = req.query.limit;
  const page = Number(pageValue ?? 1);
  const limit = Number(limitValue ?? 10);

  if (
    (pageValue !== undefined && (typeof pageValue !== "string" || !pageValue.trim())) ||
    (limitValue !== undefined && (typeof limitValue !== "string" || !limitValue.trim())) ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error("page and limit must be valid integers (limit max 100)");
  }

  return { page, limit, skip: (page - 1) * limit };
};

export const getDashboardSummary = async (req, res) => {
  try {
    const [
      totalCustomers, activeCustomers,
      totalDrivers, approvedDrivers, pendingDrivers,
      totalVehicles, activeVehicles, availableVehicles,
      bookingCounts,
      paymentStats,
      ratingStats,
      complaintStats
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "customer", isActive: true }),
      Driver.countDocuments(),
      Driver.countDocuments({ approvalStatus: "approved" }),
      Driver.countDocuments({ approvalStatus: "pending" }),
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ isActive: true }),
      Vehicle.countDocuments({ isAvailable: true }),
      Booking.aggregate([{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $group: {
            _id: "$status",
            totalAmount: { $sum: "$amount" },
            refundedAmount: { $sum: "$refundAmount" }
        }}
      ]),
      Rating.aggregate([{ $group: { _id: null, avgRating: { $avg: "$rating" } } }]),
      Complaint.countDocuments({ status: "open" })
    ]);

    const bookings = bookingCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      acc.total = (acc.total || 0) + curr.count;
      return acc;
    }, { total: 0 });

    const totalPaidAmount = paymentStats.find(p => p._id === "success")?.totalAmount || 0;
    const totalRefundedAmount = paymentStats.reduce((sum, curr) => sum + (curr.refundedAmount || 0), 0);
    const totalRevenue = totalPaidAmount - totalRefundedAmount;

    return successResponse(res, {
      totalCustomers, activeCustomers,
      totalDrivers, approvedDrivers, pendingDrivers,
      totalVehicles, activeVehicles, availableVehicles,
      totalBookings: bookings.total,
      pendingBookings: bookings.pending || 0,
      acceptedBookings: bookings.accepted || 0,
      rejectedBookings: bookings.rejected || 0,
      cancelledBookings: bookings.cancelled || 0,
      inProgressBookings: bookings["in-progress"] || 0,
      completedBookings: bookings.completed || 0,
      totalRevenue,
      totalPaidAmount,
      totalRefundedAmount,
      averageRating: ratingStats[0]?.avgRating ? parseFloat(ratingStats[0].avgRating.toFixed(2)) : 0,
      openComplaints: complaintStats
    }, "Dashboard summary fetched");
  } catch (error) {
    console.error("Dashboard error:", error);
    return errorResponse(res, "Failed to fetch dashboard", 500);
  }
};

export const getBookingAnalytics = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;
    if (req.query.status) match.bookingStatus = req.query.status;
    if (req.query.vehicleType) match.vehicleType = req.query.vehicleType;

    const [summaryResult, byStatus, byVehicleType, daily] = await Promise.all([
      Booking.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: 1 }, avgFare: { $avg: "$finalFare" },
                    completed: { $sum: { $cond: [{ $eq: ["$bookingStatus", "completed"] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ["$bookingStatus", "cancelled"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ["$bookingStatus", "rejected"] }, 1, 0] } } } }
      ]),
      Booking.aggregate([{ $match: match }, { $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: match }, { $group: { _id: "$vehicleType", count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    const summary = summaryResult[0] || { total: 0, avgFare: 0, completed: 0, cancelled: 0, rejected: 0 };
    return successResponse(res, { summary, byStatus, byVehicleType, daily }, "Booking analytics fetched");
  } catch (error) {
    console.error("Booking analytics error:", error);
    return errorResponse(res, "Failed to fetch booking analytics", 500);
  }
};

export const getRevenueReport = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;
    
    const groupByFormat = req.query.groupBy === "week" ? "%Y-%U" : (req.query.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d");

    const [summaryResult, series] = await Promise.all([
      Payment.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            grossRevenue: { $sum: { $cond: [{ $eq: ["$status", "success"] }, "$amount", 0] } },
            refundedAmount: { $sum: "$refundAmount" },
            transactionCount: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
            failedCount: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            refundedCount: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] } }
        }}
      ]),
      Payment.aggregate([
        { $match: match },
        { $group: {
            _id: { $dateToString: { format: groupByFormat, date: "$createdAt" } },
            revenue: { $sum: { $cond: [{ $eq: ["$status", "success"] }, "$amount", 0] } }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const summary = summaryResult[0] || { grossRevenue: 0, refundedAmount: 0, transactionCount: 0, successCount: 0, failedCount: 0, refundedCount: 0 };
    summary.netRevenue = summary.grossRevenue - summary.refundedAmount;
    
    return successResponse(res, { summary, series }, "Revenue report fetched");
  } catch (error) {
    console.error("Revenue report error:", error);
    return errorResponse(res, "Failed to fetch revenue report", 500);
  }
};

export const getCustomerReport = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const userMatch = { role: "customer" };
    if (Object.keys(dateFilter.match).length > 0) userMatch.createdAt = dateFilter.match;

    const totalCustomers = await User.countDocuments(userMatch);
    const activeCustomers = await User.countDocuments({ ...userMatch, isActive: true });
    
    // For top customers, we need to join bookings
    const topCustomersByBookings = await Booking.aggregate([
      { $match: { bookingStatus: "completed" } },
      { $group: { _id: "$customer", count: { $sum: 1 }, totalPaid: { $sum: "$finalFare" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "customerObj" } },
      { $unwind: "$customerObj" },
      { $project: { _id: 1, count: 1, totalPaid: 1, "customerObj.name": 1, "customerObj.email": 1, "customerObj.phone": 1 } }
    ]);

    return successResponse(res, {
      totalCustomers,
      activeCustomers,
      topCustomersByBookings
    }, "Customer report fetched");
  } catch (error) {
    console.error("Customer report error:", error);
    return errorResponse(res, "Failed to fetch customer report", 500);
  }
};

export const getDriverReport = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const driverMatch = {};
    if (Object.keys(dateFilter.match).length > 0) driverMatch.createdAt = dateFilter.match;

    const [driverCounts, totalCompletedTrips] = await Promise.all([
      Driver.aggregate([
        { $match: driverMatch },
        { $group: { _id: "$approvalStatus", count: { $sum: 1 } } }
      ]),
      Booking.countDocuments({ bookingStatus: "completed" })
    ]);

    const counts = driverCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      acc.total = (acc.total || 0) + curr.count;
      return acc;
    }, { total: 0 });

    const topDrivers = await Driver.find().sort({ totalTrips: -1 }).limit(10).select("fullName phone totalTrips rating");

    return successResponse(res, {
      totalDrivers: counts.total,
      approvedDrivers: counts.approved || 0,
      pendingDrivers: counts.pending || 0,
      rejectedDrivers: counts.rejected || 0,
      suspendedDrivers: counts.suspended || 0,
      totalCompletedTrips,
      topDrivers
    }, "Driver report fetched");
  } catch (error) {
    console.error("Driver report error:", error);
    return errorResponse(res, "Failed to fetch driver report", 500);
  }
};

export const getVehicleReport = async (req, res) => {
  try {
    const [counts, byType, byBodyType] = await Promise.all([
      Vehicle.aggregate([
        { $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            inactive: { $sum: { $cond: [{ $not: "$isActive" }, 1, 0] } },
            available: { $sum: { $cond: ["$isAvailable", 1, 0] } },
            unavailable: { $sum: { $cond: [{ $not: "$isAvailable" }, 1, 0] } }
        }}
      ]),
      Vehicle.aggregate([{ $group: { _id: "$vehicleType", count: { $sum: 1 } } }]),
      Vehicle.aggregate([{ $group: { _id: "$bodyType", count: { $sum: 1 } } }])
    ]);

    const summary = counts[0] || { total: 0, active: 0, inactive: 0, available: 0, unavailable: 0 };
    return successResponse(res, {
      totalVehicles: summary.total,
      activeVehicles: summary.active,
      inactiveVehicles: summary.inactive,
      availableVehicles: summary.available,
      unavailableVehicles: summary.unavailable,
      vehiclesByVehicleType: byType,
      vehiclesByBodyType: byBodyType
    }, "Vehicle report fetched");
  } catch (error) {
    console.error("Vehicle report error:", error);
    return errorResponse(res, "Failed to fetch vehicle report", 500);
  }
};

export const getPaymentReport = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;
    if (req.query.status) match.status = req.query.status;
    if (req.query.method) match.method = req.query.method;
    if (req.query.provider) match.provider = req.query.provider;

    const [summary, byMethod, byProvider] = await Promise.all([
      Payment.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            totalCount: { $sum: 1 },
            successful: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] } },
            totalAmount: { $sum: { $cond: [{ $eq: ["$status", "success"] }, "$amount", 0] } },
            refundedAmount: { $sum: "$refundAmount" }
        }}
      ]),
      Payment.aggregate([{ $match: match }, { $group: { _id: "$method", count: { $sum: 1 } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: "$provider", count: { $sum: 1 } } }])
    ]);

    return successResponse(res, {
      summary: summary[0] || { totalCount: 0, successful: 0, failed: 0, pending: 0, refunded: 0, totalAmount: 0, refundedAmount: 0 },
      methodBreakdown: byMethod,
      providerBreakdown: byProvider
    }, "Payment report fetched");
  } catch (error) {
    console.error("Payment report error:", error);
    return errorResponse(res, "Failed to fetch payment report", 500);
  }
};

export const getRatingReport = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = getPagination(req);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { limit } = pagination;
    
    const [summary, recentRatings] = await Promise.all([
      Rating.aggregate([
        { $group: {
            _id: null,
            totalRatings: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            distribution: { $push: "$rating" }
        }}
      ]),
      Rating.find().sort({ createdAt: -1 }).limit(limit)
        .populate("customer", "name email")
        .populate("driver", "fullName phone")
    ]);

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (summary[0]) {
      summary[0].distribution.forEach(r => { if (dist[r] !== undefined) dist[r]++; });
    }

    return successResponse(res, {
      totalRatings: summary[0]?.totalRatings || 0,
      averageRating: summary[0]?.averageRating ? parseFloat(summary[0].averageRating.toFixed(2)) : 0,
      ratingDistribution: dist,
      recentRatings
    }, "Rating report fetched");
  } catch (error) {
    console.error("Rating report error:", error);
    return errorResponse(res, "Failed to fetch rating report", 500);
  }
};

export const getComplaintReport = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = getPagination(req);
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { limit } = pagination;
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;

    const [summary, recentComplaints] = await Promise.all([
      Complaint.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
            inReview: { $sum: { $cond: [{ $eq: ["$status", "in-review"] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } }
        }}
      ]),
      Complaint.find(match).sort({ createdAt: -1 }).limit(limit)
        .populate("raisedBy", "name email role")
    ]);

    return successResponse(res, {
      summary: summary[0] || { totalComplaints: 0, open: 0, inReview: 0, resolved: 0, closed: 0 },
      recentComplaints
    }, "Complaint report fetched");
  } catch (error) {
    console.error("Complaint report error:", error);
    return errorResponse(res, "Failed to fetch complaint report", 500);
  }
};

export const exportBookings = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;
    if (req.query.status) match.bookingStatus = req.query.status;

    const bookings = await Booking.find(match).sort({ createdAt: -1 }).limit(500)
      .populate("customer", "name email phone")
      .populate("driver", "fullName phone")
      .populate("vehicle", "vehicleNumber vehicleType");

    const exportData = bookings.map(b => ({
      bookingId: b.bookingId,
      createdAt: b.createdAt,
      status: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      estimatedFare: b.estimatedFare,
      finalFare: b.finalFare,
      customerName: b.customer?.name,
      customerPhone: b.customer?.phone,
      driverName: b.driver?.fullName || "Unassigned",
      vehicleType: b.vehicleType
    }));

    return successResponse(res, { exportData }, "Booking export generated");
  } catch (error) {
    console.error("Export bookings error:", error);
    return errorResponse(res, "Failed to generate export", 500);
  }
};

export const exportPayments = async (req, res) => {
  try {
    let dateFilter = {};
    try { dateFilter = parseDateRange(req.query.from, req.query.to); } catch(e) { return errorResponse(res, e.message, 400); }
    
    const match = {};
    if (Object.keys(dateFilter.match).length > 0) match.createdAt = dateFilter.match;
    if (req.query.status) match.status = req.query.status;

    const payments = await Payment.find(match).sort({ createdAt: -1 }).limit(500)
      .populate("customer", "name email phone");

    const exportData = payments.map(p => ({
      paymentId: p._id,
      transactionId: p.transactionId,
      orderId: p.orderId,
      createdAt: p.createdAt,
      status: p.status,
      method: p.method,
      amount: p.amount,
      refundAmount: p.refundAmount,
      customerName: p.customer?.name,
      customerPhone: p.customer?.phone
    }));

    return successResponse(res, { exportData }, "Payment export generated");
  } catch (error) {
    console.error("Export payments error:", error);
    return errorResponse(res, "Failed to generate export", 500);
  }
};
