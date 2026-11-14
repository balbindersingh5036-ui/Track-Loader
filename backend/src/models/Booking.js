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

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
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

    vehicleModel: {
      type: String,
      trim: true,
      default: ""
    },

    vehicleName: {
      type: String,
      trim: true,
      default: ""
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

    routeGeometry: {
      type: String,
      default: ""
    },

    pricingSnapshot: {
      category: { type: String, default: "" },
      ratePerKm: { type: Number, default: 0 },
      ratePerTon: { type: Number, default: 0 },
      minimumFare: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      distanceMeters: { type: Number, default: 0 },
      cargoWeightKg: { type: Number, default: 0 },
      weightInTon: { type: Number, default: 0 },
      distanceCharge: { type: Number, default: 0 },
      weightCharge: { type: Number, default: 0 },
      calculatedFare: { type: Number, default: 0 },
      finalFare: { type: Number, default: 0 },
      durationSeconds: { type: Number, default: 0 },
      routingProfile: { type: String, default: "driving-hgv" },
      calculatedAt: { type: Date, default: Date.now }
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

    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
      uppercase: true,
      index: true
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

    cashCollectedAt: {
      type: Date,
      default: null
    },

    cashCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    cashCollectionNotes: {
      type: String,
      default: "",
      trim: true
    },

    paymentHistory: [{
      action: {
        type: String,
        enum: ["initiated", "method_changed", "order_created", "paid", "cash_collected", "failed", "refunded"],
        required: true
      },
      paymentMethod: {
        type: String,
        enum: ["COD", "ONLINE"],
        default: "COD"
      },
      status: {
        type: String,
        default: "pending"
      },
      amount: {
        type: Number,
        default: 0
      },
      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      actorRole: {
        type: String,
        default: "system"
      },
      notes: {
        type: String,
        default: ""
      },
      occurredAt: {
        type: Date,
        default: Date.now
      }
    }],

    bookingMode: {
      type: String,
      enum: ["instant", "scheduled"],
      default: "instant",
      index: true
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },

    alternativeVehicleAssigned: {
      type: Boolean,
      default: false
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

    assignmentStatus: {
      type: String,
      enum: ["unassigned", "pending_acceptance", "accepted", "rejected"],
      default: "unassigned",
      index: true
    },

    assignmentHistory: [{
      action: {
        type: String,
        enum: ["created", "assigned", "accepted", "rejected", "cancelled", "started", "completed"],
        required: true
      },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      actorRole: {
        type: String,
        enum: ["customer", "agency", "driver", "admin", "system"],
        required: true
      },
      driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
      vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
      reason: { type: String, default: "", trim: true },
      occurredAt: { type: Date, default: Date.now }
    }],

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