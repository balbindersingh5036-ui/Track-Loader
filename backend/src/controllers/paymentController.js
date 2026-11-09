import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { errorResponse, successResponse } from "../utils/response.js";
import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  fetchRazorpayPayment,
  createRefund
} from "../services/paymentService.js";
import { notifyCustomer } from "../services/notificationService.js";
import { emitToBooking } from "../sockets/socket.js";
import { isSettingEnabled } from "../services/systemSettingService.js";
import { env } from "../config/env.js";

export const createOrder = async (req, res) => {
  try {
    const isPaymentEnabled = await isSettingEnabled("payment.enabled");
    if (!isPaymentEnabled) {
      return errorResponse(res, "Online payment is currently unavailable", 403);
    }

    const { bookingId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) return errorResponse(res, "Invalid booking ID", 400);

    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking) return errorResponse(res, "Booking not found", 404);

    if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "completed") {
      return errorResponse(res, "Cannot pay for a cancelled or completed booking", 400);
    }
    if (booking.paymentStatus === "paid") {
      return errorResponse(res, "Booking is already paid", 409);
    }
    if (booking.paymentMethod === "COD") {
      return errorResponse(res, "This booking is set to Cash on Delivery (COD) and cannot create an online payment order. Switch payment method to ONLINE if you wish to pay digitally.", 400);
    }

    const amount = booking.estimatedFare;
    if (!amount || amount <= 0) return errorResponse(res, "Invalid booking amount", 400);

    let payment = await Payment.findOne({ booking: bookingId });
    if (payment) {
      if (payment.status === "success") return errorResponse(res, "Payment already successful", 409);
      // If a pending order already exists for the same amount, reuse it to prevent duplicate order generation
      if (payment.orderId && payment.amount === amount) {
        return successResponse(res, {
          paymentId: payment._id,
          bookingId: booking._id,
          orderId: payment.orderId,
          amount: Math.round(payment.amount * 100),
          currency: "INR",
          keyId: env.razorpay.keyId
        }, "Existing order reused");
      }
    }

    const order = await createRazorpayOrder(amount, bookingId.toString());

    if (payment) {
      payment.orderId = order.id;
      payment.amount = amount;
      await payment.save();
    } else {
      payment = new Payment({
        booking: bookingId,
        customer: req.user._id,
        amount,
        method: "online",
        provider: "razorpay",
        orderId: order.id
      });
      await payment.save();
    }

    return successResponse(res, {
      paymentId: payment._id,
      bookingId: booking._id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId
    }, "Order created");
  } catch (error) {
    console.error("Create order error:", error?.message || error);
    const statusCode = error.statusCode || 500;
    const message = error.message || "Failed to create order";
    return errorResponse(res, message, statusCode);
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) return errorResponse(res, "Invalid booking ID", 400);
    const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
    if (!booking) return errorResponse(res, "Booking not found", 404);

    if (booking.paymentStatus === "paid") return errorResponse(res, "Already paid", 409);

    const payment = await Payment.findOne({ booking: bookingId, orderId: razorpay_order_id });
    if (!payment) return errorResponse(res, "Payment record not found", 404);
    if (payment.status === "success") return errorResponse(res, "Already processed", 409);

    const isValid = verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return errorResponse(res, "Invalid signature", 400);

    // Verify against Razorpay provider API that payment genuinely exists, belongs to order, and is captured/authorized
    let providerPayment;
    try {
      providerPayment = await fetchRazorpayPayment(razorpay_payment_id);
    } catch (providerErr) {
      console.error("Provider payment fetch error:", providerErr.message);
      return errorResponse(res, "Payment could not be verified with gateway provider", 400);
    }

    if (!providerPayment || providerPayment.order_id !== razorpay_order_id) {
      return errorResponse(res, "Payment does not match the booking order", 400);
    }

    if (!["captured", "authorized"].includes(providerPayment.status)) {
      return errorResponse(res, `Payment status is ${providerPayment.status}, not completed`, 400);
    }

    payment.status = "success";
    payment.transactionId = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();

    booking.paymentStatus = "paid";
    booking.paymentMethod = "ONLINE";
    if (!Array.isArray(booking.paymentHistory)) {
      booking.paymentHistory = [];
    }
    booking.paymentHistory.push({
      action: "paid",
      paymentMethod: "ONLINE",
      status: "paid",
      amount: payment.amount,
      actor: req.user._id,
      actorRole: req.user.role || "customer",
      occurredAt: new Date()
    });
    await booking.save();

    await notifyCustomer(booking.customer, "Payment Successful", `Your payment for booking ${booking.bookingId} was successful`, booking._id);
    emitToBooking(booking._id, "payment:success", { bookingId: booking._id, status: "success", paymentId: payment._id });

    return successResponse(res, { payment }, "Payment verified");
  } catch (error) {
    console.error("Verify payment error:", error);
    return errorResponse(res, "Failed to verify payment", 500);
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) return errorResponse(res, "Invalid booking ID", 400);

    const booking = await Booking.findById(bookingId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    // Verify access
    if (req.user.role === "customer" && booking.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, "Access denied", 403);
    }

    if (req.user.role === "driver") {
      const Driver = mongoose.model("Driver");
      const driver = await Driver.findOne({ user: req.user._id });
      if (!driver || !booking.driver || booking.driver.toString() !== driver._id.toString()) {
        return errorResponse(res, "Access denied", 403);
      }
    }

    if (req.user.role === "agency") {
      const Agency = mongoose.model("Agency");
      const agency = await Agency.findOne({ owner: req.user._id });
      if (!agency || !booking.agency || booking.agency.toString() !== agency._id.toString()) {
        return errorResponse(res, "Access denied", 403);
      }
    }

    const payment = await Payment.findOne({ booking: bookingId });

    return successResponse(res, {
      bookingId: booking._id,
      paymentMethod: booking.paymentMethod || "COD",
      paymentStatus: booking.paymentStatus,
      amount: booking.finalFare || booking.estimatedFare,
      currency: "INR",
      provider: payment?.provider || (booking.paymentMethod === "COD" ? "cash" : "razorpay"),
      orderId: payment?.orderId || "",
      transactionId: payment?.transactionId || "",
      paidAt: payment?.paidAt || booking.cashCollectedAt || null,
      cashCollectedAt: booking.cashCollectedAt || null,
      cashCollectedBy: booking.cashCollectedBy || null,
      refundAmount: payment?.refundAmount || 0,
      refundedAt: payment?.refundedAt || null
    }, "Payment status fetched");
  } catch (error) {
    console.error("Get payment status error:", error);
    return errorResponse(res, "Failed to fetch payment status", 500);
  }
};

export const recordCashCollection = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.body.bookingId;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return errorResponse(res, "Invalid booking ID", 400);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return errorResponse(res, "Booking not found", 404);
    }

    // Authorization check
    let authorizedRole = null;
    if (req.user.role === "admin") {
      authorizedRole = "admin";
    } else if (req.user.role === "driver") {
      const Driver = mongoose.model("Driver");
      const driver = await Driver.findOne({ user: req.user._id });
      if (driver && booking.driver && booking.driver.toString() === driver._id.toString()) {
        authorizedRole = "driver";
      } else {
        return errorResponse(res, "You are not the driver assigned to this booking", 403);
      }
    } else if (req.user.role === "agency") {
      const Agency = mongoose.model("Agency");
      const agency = await Agency.findOne({ owner: req.user._id });
      if (agency && booking.agency && booking.agency.toString() === agency._id.toString()) {
        authorizedRole = "agency";
      } else {
        return errorResponse(res, "You are not the agency owner assigned to this booking", 403);
      }
    } else {
      return errorResponse(res, "Unauthorized to confirm cash collection", 403);
    }

    if (booking.bookingStatus === "cancelled") {
      return errorResponse(res, "Cannot record cash collection for a cancelled booking", 400);
    }

    if (booking.paymentMethod !== "COD") {
      return errorResponse(res, `This booking is set to ${booking.paymentMethod || "ONLINE"}, not Cash on Delivery`, 400);
    }

    if (booking.paymentStatus === "paid") {
      return errorResponse(res, "Cash collection has already been recorded and marked as paid", 409);
    }

    const { notes } = req.body;
    const amount = Number(booking.finalFare || booking.estimatedFare || 0);
    const collectionTime = new Date();

    booking.paymentStatus = "paid";
    booking.cashCollectedAt = collectionTime;
    booking.cashCollectedBy = req.user._id;
    booking.cashCollectionNotes = notes ? String(notes).trim() : `Cash payment verified by ${authorizedRole}`;

    if (!Array.isArray(booking.paymentHistory)) {
      booking.paymentHistory = [];
    }
    booking.paymentHistory.push({
      action: "cash_collected",
      paymentMethod: "COD",
      status: "paid",
      amount,
      actor: req.user._id,
      actorRole: authorizedRole,
      notes: booking.cashCollectionNotes,
      occurredAt: collectionTime
    });

    await booking.save();

    // Create or update payment record
    let payment = await Payment.findOne({ booking: booking._id });
    if (payment) {
      payment.method = "cash";
      payment.status = "success";
      payment.amount = amount;
      payment.paidAt = collectionTime;
      await payment.save();
    } else {
      payment = await Payment.create({
        booking: booking._id,
        customer: booking.customer,
        amount,
        method: "cash",
        provider: "cash",
        status: "success",
        paidAt: collectionTime
      });
    }

    await notifyCustomer(
      booking.customer,
      "Cash Payment Collected",
      `Cash payment of ₹${amount.toFixed(2)} has been confirmed for booking ${booking.bookingId}`,
      booking._id
    );

    emitToBooking(booking._id, "payment:cash_collected", {
      bookingId: booking._id,
      paymentStatus: "paid",
      paymentMethod: "COD",
      amount,
      collectedAt: collectionTime,
      collectedBy: req.user._id
    });

    return successResponse(res, {
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      amount,
      cashCollectedAt: booking.cashCollectedAt,
      cashCollectedBy: booking.cashCollectedBy
    }, "Cash collection confirmed successfully");
  } catch (error) {
    console.error("Record cash collection error:", error);
    return errorResponse(res, "Failed to record cash collection", 500);
  }
};

export const updatePaymentMethod = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.body.bookingId;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return errorResponse(res, "Invalid booking ID", 400);
    }

    const { paymentMethod } = req.body;
    const normalized = String(paymentMethod || "").trim().toUpperCase();
    if (!["COD", "ONLINE"].includes(normalized)) {
      return errorResponse(res, "Invalid payment method. Supported methods are COD and ONLINE", 400);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    if (req.user.role !== "admin" && String(booking.customer) !== String(req.user._id)) {
      return errorResponse(res, "Access denied", 403);
    }

    if (booking.paymentStatus === "paid") {
      return errorResponse(res, "Cannot change payment method for an already paid booking", 409);
    }

    if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "completed") {
      return errorResponse(res, `Cannot change payment method for a ${booking.bookingStatus} booking`, 400);
    }

    const previousMethod = booking.paymentMethod || "COD";
    booking.paymentMethod = normalized;

    if (!Array.isArray(booking.paymentHistory)) {
      booking.paymentHistory = [];
    }
    booking.paymentHistory.push({
      action: "method_changed",
      paymentMethod: normalized,
      status: booking.paymentStatus,
      amount: booking.finalFare || booking.estimatedFare,
      actor: req.user._id,
      actorRole: req.user.role,
      notes: `Payment method changed from ${previousMethod} to ${normalized}`,
      occurredAt: new Date()
    });

    await booking.save();

    return successResponse(res, {
      bookingId: booking._id,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus
    }, `Payment method updated to ${normalized}`);
  } catch (error) {
    console.error("Update payment method error:", error);
    return errorResponse(res, "Failed to update payment method", 500);
  }
};

export const recordRefundResponse = async (payment, refund) => {
  const validResult = refund?.id
    && ["pending", "processed", "failed"].includes(refund.status)
    && Number.isFinite(refund.amount)
    && refund.amount > 0;
  if (!validResult) {
    if (refund?.id) payment.refundId = refund.id;
    payment.refundStatus = "unknown";
    payment.refundInitiatedAt = payment.refundInitiatedAt || new Date();
    await payment.save();
    return {
      error: "Payment provider returned an incomplete refund response. Review the gateway before retrying.",
      statusCode: 502
    };
  }

  payment.refundStatus = refund.status;
  payment.refundAmount = refund.status === "failed" ? 0 : refund.amount / 100;
  payment.refundId = refund.id;
  payment.refundInitiatedAt = refund.created_at ? new Date(refund.created_at * 1000) : new Date();
  if (refund.status === "processed") {
    payment.status = "refunded";
    payment.refundedAt = payment.refundInitiatedAt;
  }
  await payment.save();

  return {
    refundStatus: refund.status,
    processed: refund.status === "processed",
    message: refund.status === "processed"
      ? "Refund processed"
      : refund.status === "pending"
        ? "Refund request is pending with the payment provider"
        : "Payment provider reports that the refund failed"
  };
};

export const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(paymentId)) return errorResponse(res, "Invalid payment ID", 400);

    const payment = await Payment.findById(paymentId).populate("booking");
    if (!payment) return errorResponse(res, "Payment not found", 404);
    if (payment.status !== "success") return errorResponse(res, "Cannot refund unsuccessful payment", 400);
    if (payment.status === "refunded" || payment.refundId) return errorResponse(res, "Payment already refunded", 409);
    if (payment.refundAmount > 0) return errorResponse(res, "Payment already has a recorded refund", 409);
    if (!payment.transactionId || !Number.isFinite(payment.amount) || payment.amount <= 0) {
      return errorResponse(res, "Payment does not have a valid refundable transaction", 400);
    }

    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        status: "success",
        transactionId: payment.transactionId,
        refundId: { $in: ["", null] },
        refundStatus: { $in: ["", null] },
        refundAmount: { $in: [0, null] }
      },
      { $set: { refundStatus: "pending", refundInitiatedAt: new Date() } },
      { new: true }
    ).populate("booking");
    if (!claimedPayment) return errorResponse(res, "Refund is already in progress or this payment is no longer eligible", 409);

    let refund;
    try {
      refund = await createRefund(claimedPayment.transactionId);
    } catch (error) {
      claimedPayment.refundStatus = "unknown";
      await claimedPayment.save();
      throw error;
    }

    const paymentToUpdate = claimedPayment;
    const outcome = await recordRefundResponse(paymentToUpdate, refund);
    if (outcome.error) {
      console.error("Razorpay refund response did not contain valid refund status and amount");
      return errorResponse(res, outcome.error, outcome.statusCode);
    }

    if (paymentToUpdate.booking && outcome.processed) {
      paymentToUpdate.booking.paymentStatus = "refunded";
      await paymentToUpdate.booking.save();

      await notifyCustomer(paymentToUpdate.customer, "Payment Refunded", `Your payment for booking ${paymentToUpdate.booking.bookingId} has been refunded`, paymentToUpdate.booking._id);
      emitToBooking(paymentToUpdate.booking._id, "payment:refunded", { bookingId: paymentToUpdate.booking._id, status: "refunded" });
    }

    return successResponse(res, { payment: paymentToUpdate }, outcome.message);
  } catch (error) {
    console.error("Refund error:", error?.statusCode || "processing error");
    return errorResponse(res, "Failed to process refund", 500);
  }
};

export const processWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody; // Assumes raw body middleware attaches it

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;
    
    // Idempotent webhook processing
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const transactionId = paymentEntity.id;
      
      const payment = await Payment.findOne({ orderId });
      if (payment && payment.status !== "success") {
        payment.status = "success";
        payment.transactionId = transactionId;
        payment.paidAt = new Date();
        await payment.save();

        const booking = await Booking.findById(payment.booking);
        if (booking && booking.paymentStatus !== "paid") {
          booking.paymentStatus = "paid";
          await booking.save();
          await notifyCustomer(booking.customer, "Payment Successful", `Your payment for booking ${booking.bookingId} was successful`, booking._id);
          emitToBooking(booking._id, "payment:success", { bookingId: booking._id, status: "success" });
        }
      }
    } else if (event.event === "payment.failed") {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      
      const payment = await Payment.findOne({ orderId });
      if (payment && payment.status === "pending") {
        payment.status = "failed";
        await payment.save();
        
        if (payment.booking) {
          const booking = await Booking.findById(payment.booking);
          if (booking) {
            booking.paymentStatus = "failed";
            await booking.save();
            await notifyCustomer(booking.customer, "Payment Failed", `Your payment for booking ${booking.bookingId} has failed`, booking._id);
            emitToBooking(booking._id, "payment:failed", { bookingId: booking._id, status: "failed" });
          }
        }
      }
    } else if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refundEntity = event.payload.refund.entity;
      const payment = await Payment.findOne({
        transactionId: refundEntity.payment_id,
        refundId: refundEntity.id
      });
      if (payment && payment.refundStatus !== "processed" && payment.refundStatus !== "failed") {
        payment.refundStatus = event.event === "refund.processed" ? "processed" : "failed";
        if (event.event === "refund.processed") {
          payment.status = "refunded";
          payment.refundAmount = Number.isFinite(refundEntity.amount) ? refundEntity.amount / 100 : payment.refundAmount;
          payment.refundedAt = refundEntity.processed_at
            ? new Date(refundEntity.processed_at * 1000)
            : new Date();
        } else {
          payment.refundAmount = 0;
          payment.refundedAt = null;
        }
        await payment.save();

        if (event.event === "refund.processed" && payment.booking) {
          const booking = await Booking.findById(payment.booking);
          if (booking) {
            booking.paymentStatus = "refunded";
            await booking.save();
            await notifyCustomer(payment.customer, "Payment Refunded", `Your payment for booking ${booking.bookingId} has been refunded`, booking._id);
            emitToBooking(booking._id, "payment:refunded", { bookingId: booking._id, status: "refunded" });
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook Error");
  }
};
