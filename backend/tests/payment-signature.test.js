import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature, fetchRazorpayPayment } from "../src/services/paymentService.js";
import { env } from "../src/config/env.js";

test("Payment Verification: HMAC SHA-256 signature verification succeeds with valid secret", () => {
  const orderId = "order_test_12345";
  const paymentId = "pay_test_67890";
  const body = orderId + "|" + paymentId;
  const validSignature = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(body)
    .digest("hex");

  const result = verifyRazorpayPaymentSignature(orderId, paymentId, validSignature);
  assert.equal(result, true, "Signature verification must succeed for valid signature");

  const invalidResult = verifyRazorpayPaymentSignature(orderId, paymentId, "invalid_signature_hex");
  assert.equal(invalidResult, false, "Signature verification must fail for invalid signature");
});

test("Payment Verification: Fabricated payment ID rejection with Razorpay API", async () => {
  const fabricatedPaymentId = "pay_fabricated_fake_id_99999";
  await assert.rejects(
    async () => {
      await fetchRazorpayPayment(fabricatedPaymentId);
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /does not exist|not found/i);
      return true;
    },
    "Fetching a fabricated payment ID from Razorpay must fail with 400"
  );
});

test("Payment Verification: Webhook signature verification validates authenticity", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_test_001" } } } });
  const validWebhookSig = crypto
    .createHmac("sha256", env.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");

  assert.equal(verifyRazorpayWebhookSignature(rawBody, validWebhookSig), true);
  assert.equal(verifyRazorpayWebhookSignature(rawBody, "tampered_signature"), false);
});
