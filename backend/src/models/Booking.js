import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null
    },

    pickup: {
      address: {
        type: String,
        required: true,
        trim: true
      },

      latitude: {
        type: Number,
        required: true
      },

      longitude: {
        type: Number,
        required: true
      }
    },

    drop: {
      address: {
        type: String,
        required: true,
        trim: true
      },

      latitude: {
        type: Number,
        required: true
      },

      longitude: {
        type: Number,
        required: true
      }
    },

    distanceKm: {
      type: Number,
      default: 0,
      min: 0
    },

    goods: {
      type: String,
      required: true,
      trim: true
    },

    weight: {
      value: {
        type: Number,
        required: true,
        min: 0
      },

      unit: {
        type: String,
        enum: ["kg", "ton"],
        default: "kg"
      }
    },

    preferredPickupDate: {
      type: Date,
      required: true
    },

    preferredPickupTime: {
      type: String,
      required: true
    },

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
      index: true
    },

    estimatedFare: {
      type: Number,
      required: true,
      min: 0
    },

    finalFare: {
      type: Number,
      default: 0,
      min: 0
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "cash"
      ],
      default: "pending",
      index: true
    },

    bookingStatus: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "in-progress",
        "completed"
      ],
      default: "pending",
      index: true
    },

    customerNote: {
      type: String,
      default: "",
      trim: true
    },

    cancellationReason: {
      type: String,
      default: ""
    },

    rejectedReason: {
      type: String,
      default: ""
    },

    acceptedAt: {
      type: Date,
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;