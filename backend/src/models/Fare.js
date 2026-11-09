import mongoose from "mongoose";

const fareHistorySchema = new mongoose.Schema(
  {
    perKmRate: { type: Number, required: true, min: 0 },
    perTonRate: { type: Number, required: true, min: 0 },
    minimumFare: { type: Number, required: true, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const fareSchema = new mongoose.Schema(
  {
    vehicleType: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    baseFare: {
      type: Number,
      default: 0,
      min: 0
    },

    perKmRate: {
      type: Number,
      required: true,
      min: 0
    },

    perTonRate: {
      type: Number,
      default: 0,
      min: 0
    },

    minimumFare: {
      type: Number,
      required: true,
      min: 0
    },

    loadingCharge: {
      type: Number,
      default: 0,
      min: 0
    },

    unloadingCharge: {
      type: Number,
      default: 0,
      min: 0
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    history: {
      type: [fareHistorySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Fare = mongoose.model("Fare", fareSchema);

export default Fare;