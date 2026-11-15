import assert from "node:assert/strict";
import test from "node:test";

import Payment from "../src/models/Payment.js";
import {
  calculateFinalPricingSnapshot,
  reconcileOnlineSettlement
} from "../src/services/bookingSettlementService.js";

test("final fare recalculates the distance component for a shorter trip", () => {
  const snapshot = calculateFinalPricingSnapshot({
    estimatedFare: 130,
    estimatedDistanceKm: 10,
    actualDistanceKm: 6,
    distanceRatePerKm: 10,
    minimumFare: 20,
    weightCharge: 20,
    loadingCharge: 5,
    unloadingCharge: 5,
    extraDistanceChargePerKm: 4
  });

  assert.equal(snapshot.baseFare, 90);
  assert.equal(snapshot.finalFare, 90);
});

test("only customer-approved extra distance and waiting are added to the final fare", () => {
  const snapshot = calculateFinalPricingSnapshot({
    estimatedFare: 115,
    estimatedDistanceKm: 10,
    actualDistanceKm: 13,
    distanceRatePerKm: 10,
    minimumFare: 20,
    waitingMinutes: 30,
    waitingChargePerHour: 12,
    extraDistanceKm: 3,
    extraDistanceChargePerKm: 4
  });

  assert.equal(snapshot.baseFare, 100);
  assert.equal(snapshot.waitingCharge, 6);
  assert.equal(snapshot.extraDistanceCharge, 12);
  assert.equal(snapshot.finalFare, 118);

  const rejectedSnapshot = calculateFinalPricingSnapshot({
    estimatedFare: 115,
    estimatedDistanceKm: 10,
    actualDistanceKm: 13,
    distanceRatePerKm: 10,
    minimumFare: 20,
    extraDistanceChargePerKm: 4
  });

  assert.equal(rejectedSnapshot.finalFare, 100);
});

test("online reconciliation requests a refund when actual distance lowers the fare", async (t) => {
  const booking = {
    _id: "booking-id",
    paymentStatus: "pending",
    settlementStatus: "pending",
    finalPricingSnapshot: {
      finalFare: 90
    }
  };
  t.mock.method(Payment, "find", () => ({
    lean: async () => [{
      amount: 130,
      status: "success",
      refundStatus: "none",
      refundAmount: 0
    }]
  }));

  const result = await reconcileOnlineSettlement(booking);

  assert.equal(result.netPaid, 130);
  assert.equal(result.refundDue, 40);
  assert.equal(booking.paymentStatus, "refund_pending");
  assert.equal(booking.settlementStatus, "pending_refund");
});
