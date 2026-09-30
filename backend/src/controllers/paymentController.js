import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import { errorResponse, successResponse } from "../utils/response.js";
import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
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

    const amount = booking.estimatedFare;
    if (!amount || amount <= 0) return errorResponse(res, "Invalid booking amount", 400);

    const order = await createRazorpayOrder(amount, bookingId.toString());

    let payment = await Payment.findOne({ booking: bookingId });
    if (payment) {
      if (payment.status === "success") return errorResponse(res, "Payment already successful", 409);
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
    console.error("Create order error:", error);
    return errorResponse(res, "Failed to create order", 500);
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

    payment.status = "success";
    payment.transactionId = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();

    booking.paymentStatus = "paid";
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

    const payment = await Payment.findOne({ booking: bookingId });
    if (!payment) return errorResponse(res, "Payment not found", 404);

    // Verify access
    if (req.user.role === "customer" && payment.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, "Access denied", 403);
    }
    // Drivers generally shouldn't need payment details unless stated. Since rules say "Driver cannot access unless explicitly required", we deny.
    if (req.user.role === "driver") return errorResponse(res, "Access denied", 403);

    return successResponse(res, {
      bookingId: payment.booking,
      paymentStatus: payment.status,
      amount: payment.amount,
      currency: "INR",
      provider: payment.provider,
      orderId: payment.orderId,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
      refundAmount: payment.refundAmount,
      refundedAt: payment.refundedAt
    }, "Payment status fetched");
  } catch (error) {
    console.error("Get payment status error:", error);
    return errorResponse(res, "Failed to fetch payment status", 500);
  }
};

export const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(paymentId)) return errorResponse(res, "Invalid payment ID", 400);

    const payment = await Payment.findById(paymentId).populate("booking");
    if (!payment) return errorResponse(res, "Payment not found", 404);
    if (payment.status !== "success") return errorResponse(res, "Cannot refund unsuccessful payment", 400);
    if (payment.status === "refunded" || payment.refundId) return errorResponse(res, "Payment already refunded", 409);

    const refund = await createRefund(payment.transactionId);

    payment.status = "refunded";
    payment.refundAmount = payment.amount;
    payment.refundId = refund.id;
    payment.refundedAt = new Date();
    await payment.save();

    if (payment.booking) {
      payment.booking.paymentStatus = "refunded";
      await payment.booking.save();

      await notifyCustomer(payment.customer, "Payment Refunded", `Your payment for booking ${payment.booking.bookingId} has been refunded`, payment.booking._id);
      emitToBooking(payment.booking._id, "payment:refunded", { bookingId: payment.booking._id, status: "refunded" });
    }

    return successResponse(res, { payment }, "Refund successful");
  } catch (error) {
    console.error("Refund error:", error);
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
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook Error");
  }
};
