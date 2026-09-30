import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    method: {
      type: String,
      enum: [
        "online",
        "cash"
      ],
      required: true
    },

    provider: {
      type: String,
      default: ""
    },

    orderId: {
      type: String,
      default: "",
      index: true
    },

    transactionId: {
      type: String,
      default: "",
      index: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "success",
        "failed",
        "refunded"
      ],
      default: "pending",
      index: true
    },

    paidAt: {
      type: Date,
      default: null
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    refundId: {
      type: String,
      default: ""
    },

    refundedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;