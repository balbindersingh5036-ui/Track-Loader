import assert from "node:assert/strict";
import test from "node:test";
import Payment from "../src/models/Payment.js";

test("payment schema includes orderId and refundId", () => {
  assert.equal(typeof Payment.schema.path("orderId"), "object");
  assert.equal(typeof Payment.schema.path("refundId"), "object");
});

test("payment status enum covers necessary transitions", () => {
  const statuses = Payment.schema.path("status").enumValues;
  assert.deepEqual(statuses, ["pending", "success", "failed", "refunded"]);
});
