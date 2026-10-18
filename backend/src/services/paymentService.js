import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import { env } from "../config/env.js";

export const createRazorpayOrder = async (amount, receipt) => {
  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: "INR",
    receipt
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error) {
    const providerMsg = error?.error?.description || error?.message || "Payment gateway provider error";
    console.error("Razorpay Create Order Error:", error?.statusCode, providerMsg);
    const err = new Error(providerMsg);
    err.statusCode = error?.statusCode || 502;
    throw err;
  }
};

export const fetchRazorpayPayment = async (paymentId) => {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    const providerMsg = error?.error?.description || error?.message || "Payment not found with provider";
    const err = new Error(providerMsg);
    err.statusCode = error?.statusCode || 400;
    throw err;
  }
};

export const verifyRazorpayPaymentSignature = (orderId, paymentId, signature) => {
  const secret = env.razorpay.keySecret;
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === signature;
};

export const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  const secret = env.razorpay.webhookSecret;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};

export const createRefund = async (paymentId, amount = null) => {
  try {
    const refundData = amount ? { amount: Math.round(amount * 100) } : {};
    const refund = await razorpayInstance.payments.refund(paymentId, refundData);
    return refund;
  } catch (error) {
    console.error("Razorpay Refund Error:", error);
    throw new Error("Failed to process refund");
  }
};
