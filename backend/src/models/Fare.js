import mongoose from "mongoose";

const fareSchema = new mongoose.Schema(
  {
    vehicleType: {
      type: String,
      enum: [
        "mini-truck",
        "pickup",
        "small-truck",
        "medium-truck",
        "large-truck"
      ],
      required: true,
      unique: true,
      index: true
    },

    baseFare: {
      type: Number,
      required: true,
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
    }
  },
  {
    timestamps: true
  }
);

const Fare = mongoose.model("Fare", fareSchema);

export default Fare;