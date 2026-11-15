import Payment from "../models/Payment.js";
import { createRefund } from "./paymentService.js";

export const calculateFinalPricingSnapshot = ({
  estimatedFare,
  estimatedDistanceKm = 0,
  actualDistanceKm,
  recalculateDistance = true,
  distanceRatePerKm = 0,
  minimumFare = 0,
  weightCharge = 0,
  loadingCharge = 0,
  unloadingCharge = 0,
  waitingMinutes,
  waitingReason,
  waitingChargePerHour,
  extraDistanceKm,
  extraDistanceReason,
  extraDistanceChargePerKm
}) => {
  const approvedWaitingMinutes = Number(waitingMinutes) || 0;
  const approvedExtraDistanceKm = Number(extraDistanceKm) || 0;
  const waitingRate = Number(waitingChargePerHour) || 0;
  const distanceRate = Number(extraDistanceChargePerKm) || 0;
  const waitingCharge = Number(((approvedWaitingMinutes / 60) * waitingRate).toFixed(2));
  const extraDistanceCharge = Number((approvedExtraDistanceKm * distanceRate).toFixed(2));
  const adjustmentsTotal = Number((waitingCharge + extraDistanceCharge).toFixed(2));
  const baseFare = Number(estimatedFare);
  const hasActualDistance = recalculateDistance && Number.isFinite(Number(actualDistanceKm));
  const billableDistanceKm = hasActualDistance
    ? Math.min(Number(actualDistanceKm), Number(estimatedDistanceKm || 0))
    : Number(estimatedDistanceKm || 0);
  const distanceCharge = hasActualDistance
    ? Number((billableDistanceKm * Number(distanceRatePerKm || 0)).toFixed(2))
    : 0;
  const recalculatedBaseFare = hasActualDistance
    ? Number(Math.max(
      distanceCharge +
        Number(weightCharge || 0) +
        Number(loadingCharge || 0) +
        Number(unloadingCharge || 0),
      Number(minimumFare || 0)
    ).toFixed(2))
    : baseFare;

  return {
    estimatedFare: baseFare,
    estimatedDistanceKm: Number(estimatedDistanceKm || 0),
    actualDistanceKm: hasActualDistance ? Number(actualDistanceKm) : Number(estimatedDistanceKm || 0),
    distanceRatePerKm: Number(distanceRatePerKm || 0),
    distanceCharge,
    minimumFare: Number(minimumFare || 0),
    weightCharge: Number(weightCharge || 0),
    loadingCharge: Number(loadingCharge || 0),
    unloadingCharge: Number(unloadingCharge || 0),
    baseFare: recalculatedBaseFare,
    waitingMinutes: approvedWaitingMinutes,
    waitingReason: approvedWaitingMinutes ? waitingReason : "",
    waitingChargePerHour: waitingRate,
    waitingCharge,
    extraDistanceKm: approvedExtraDistanceKm,
    extraDistanceReason: approvedExtraDistanceKm ? extraDistanceReason : "",
    extraDistanceChargePerKm: distanceRate,
    extraDistanceCharge,
    adjustmentsTotal,
    finalFare: Number((recalculatedBaseFare + adjustmentsTotal).toFixed(2)),
    calculatedAt: new Date()
  };
};

export const getVerifiedOnlineNetPaid = async (bookingId) => {
  const payments = await Payment.find({
    booking: bookingId,
    method: "online",
    status: { $in: ["success", "refunded"] }
  }).lean();

  return Number(payments.reduce((total, payment) => {
    const refunded = payment.refundStatus === "processed"
      ? Number(payment.refundAmount || 0)
      : 0;
    return total + Math.max(0, Number(payment.amount || 0) - refunded);
  }, 0).toFixed(2));
};

export const reconcileOnlineSettlement = async (booking) => {
  const netPaid = await getVerifiedOnlineNetPaid(booking._id);
  if (!booking.finalPricingSnapshot) {
    booking.paymentStatus = netPaid > 0 ? "partially_paid" : "pending";
    booking.settlementStatus = "pending";
    return { netPaid, refundDue: 0 };
  }

  const finalFare = Number(booking.finalPricingSnapshot.finalFare);
  const difference = Number((finalFare - netPaid).toFixed(2));
  if (difference > 0) {
    booking.paymentStatus = netPaid > 0 ? "partially_paid" : "pending";
    booking.settlementStatus = "pending_payment";
    return { netPaid, refundDue: 0, balanceDue: difference };
  }
  if (difference < 0) {
    booking.paymentStatus = "refund_pending";
    booking.settlementStatus = "pending_refund";
    return { netPaid, refundDue: Math.abs(difference), balanceDue: 0 };
  }

  booking.paymentStatus = "paid";
  booking.settlementStatus = "settled";
  return { netPaid, refundDue: 0, balanceDue: 0 };
};

export const initiateSettlementRefund = async (booking, refundAmount) => {
  if (!(refundAmount > 0)) return null;

  const initialPayment = await Payment.findOne({
    booking: booking._id,
    paymentPurpose: { $in: ["initial", null] },
    method: "online",
    status: "success",
    transactionId: { $ne: "" }
  }).sort({ createdAt: 1 });
  if (!initialPayment) {
    booking.settlementStatus = "refund_failed";
    booking.paymentStatus = "refund_pending";
    await booking.save();
    throw new Error("Original online payment was not found for the required refund");
  }
  if (initialPayment.refundStatus === "pending" || initialPayment.refundStatus === "unknown") {
    return initialPayment;
  }
  const alreadyRefunded = initialPayment.refundStatus === "processed"
    ? Number(initialPayment.refundAmount || 0)
    : 0;
  const refundableAmount = Number((Number(initialPayment.amount) - alreadyRefunded).toFixed(2));
  if (refundAmount > refundableAmount) {
    booking.settlementStatus = "refund_failed";
    booking.paymentStatus = "refund_pending";
    await booking.save();
    throw new Error("Required refund exceeds the original payment's refundable balance");
  }

  initialPayment.refundAmount = refundAmount;
  initialPayment.refundStatus = "pending";
  initialPayment.refundInitiatedAt = new Date();
  await initialPayment.save();
  booking.settlementStatus = "pending_refund";
  booking.paymentStatus = "refund_pending";
  if (!Array.isArray(booking.paymentHistory)) booking.paymentHistory = [];
  booking.paymentHistory.push({
    action: "refund_initiated",
    paymentMethod: "ONLINE",
    status: "pending",
    amount: refundAmount,
    actorRole: "system",
    notes: "Razorpay refund for final fare reconciliation",
    occurredAt: new Date()
  });
  await booking.save();

  try {
    const refund = await createRefund(initialPayment.transactionId, refundAmount);
    if (!refund?.id || !["pending", "processed", "failed"].includes(refund.status)) {
      initialPayment.refundStatus = "unknown";
      initialPayment.refundId = refund?.id || "";
      await initialPayment.save();
      booking.settlementStatus = "pending_refund";
      await booking.save();
      throw new Error("Razorpay returned an incomplete refund result");
    }

    initialPayment.refundId = refund.id;
    initialPayment.refundStatus = refund.status;
    if (refund.status === "processed") {
      initialPayment.refundAmount = Number(refund.amount) / 100;
      if (initialPayment.refundAmount >= Number(initialPayment.amount)) {
        initialPayment.status = "refunded";
      }
      initialPayment.refundedAt = refund.processed_at
        ? new Date(refund.processed_at * 1000)
        : new Date();
    } else if (refund.status === "failed") {
      initialPayment.refundAmount = 0;
      booking.settlementStatus = "refund_failed";
    }
    await initialPayment.save();
    if (refund.status === "processed") {
      if (!Array.isArray(booking.paymentHistory)) booking.paymentHistory = [];
      booking.paymentHistory.push({
        action: "settlement_updated",
        paymentMethod: "ONLINE",
        status: "refund_processed",
        amount: Number(refund.amount) / 100,
        actorRole: "system",
        notes: `Razorpay refund ${refund.id} processed`,
        occurredAt: new Date()
      });
      const settlement = await reconcileOnlineSettlement(booking);
      if (settlement.refundDue > 0) {
        booking.settlementStatus = "refund_failed";
        await booking.save();
      }
    } else {
      await booking.save();
    }
    return initialPayment;
  } catch (error) {
    if (initialPayment.refundStatus === "pending") {
      initialPayment.refundStatus = "unknown";
      await initialPayment.save();
    }
    booking.settlementStatus = "pending_refund";
    booking.paymentStatus = "refund_pending";
    await booking.save();
    throw error;
  }
};
