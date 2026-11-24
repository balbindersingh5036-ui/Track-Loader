import mongoose from "mongoose";
import {
  canonicalizeServiceCategory,
  isPassengerCategory,
  isValidCategoryVehicleType,
  SERVICE_CATEGORIES,
  VEHICLE_TYPES
} from "../utils/vehicleCategories.js";

const pricingSnapshotSchema = new mongoose.Schema({
  category: { type: String, default: "" },
  ratePerKm: { type: Number, default: 0 },
  ratePerTon: { type: Number, default: 0 },
  minimumFare: { type: Number, default: 0 },
  loadingChargeRate: { type: Number, default: 0 },
  unloadingChargeRate: { type: Number, default: 0 },
  waitingChargePerHour: { type: Number, default: 0 },
  extraDistanceChargePerKm: { type: Number, default: 0 },
  loadingCharge: { type: Number, default: 0 },
  unloadingCharge: { type: Number, default: 0 },
  waitingMinutes: { type: Number, default: 0 },
  waitingCharge: { type: Number, default: 0 },
  extraDistanceKm: { type: Number, default: 0 },
  extraDistanceCharge: { type: Number, default: 0 },
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
}, { _id: false, strict: true });

const finalPricingSnapshotSchema = new mongoose.Schema({
  estimatedFare: { type: Number, required: true, min: 0 },
  estimatedDistanceKm: { type: Number, default: 0, min: 0 },
  actualDistanceKm: { type: Number, default: 0, min: 0 },
  distanceRatePerKm: { type: Number, default: 0, min: 0 },
  distanceCharge: { type: Number, default: 0, min: 0 },
  minimumFare: { type: Number, default: 0, min: 0 },
  weightCharge: { type: Number, default: 0, min: 0 },
  loadingCharge: { type: Number, default: 0, min: 0 },
  unloadingCharge: { type: Number, default: 0, min: 0 },
  baseFare: { type: Number, default: 0, min: 0 },
  waitingMinutes: { type: Number, default: 0, min: 0 },
  waitingReason: { type: String, default: "" },
  waitingChargePerHour: { type: Number, default: 0, min: 0 },
  waitingCharge: { type: Number, default: 0, min: 0 },
  extraDistanceKm: { type: Number, default: 0, min: 0 },
  extraDistanceReason: { type: String, default: "" },
  extraDistanceChargePerKm: { type: Number, default: 0, min: 0 },
  extraDistanceCharge: { type: Number, default: 0, min: 0 },
  adjustmentsTotal: { type: Number, default: 0, min: 0 },
  finalFare: { type: Number, required: true, min: 0 },
  calculatedAt: { type: Date, required: true }
}, { _id: false, strict: true });

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

    serviceCategory: {
      type: String,
      enum: Object.values(SERVICE_CATEGORIES),
      default: SERVICE_CATEGORIES.TRUCK,
      index: true
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
      type: pricingSnapshotSchema,
      default: () => ({}),
      immutable: true
    },

    finalPricingSnapshot: {
      type: finalPricingSnapshotSchema,
      default: null
    },

    postTripAdjustments: {
      waitingMinutes: { type: Number, default: 0, min: 0 },
      waitingReason: {
        type: String,
        enum: ["", "customer_requested", "customer_unavailable"],
        default: ""
      },
      actualDistanceKm: { type: Number, default: 0, min: 0 },
      actualDistanceProvided: { type: Boolean, default: false },
      extraDistanceKm: { type: Number, default: 0, min: 0 },
      extraDistanceReason: { type: String, default: "", trim: true, maxlength: 300 },
      waitingApproved: { type: Boolean, default: false },
      extraDistanceApproved: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["not_required", "awaiting_customer_approval", "reviewed"],
        default: "not_required"
      },
      driverSubmittedAt: { type: Date, default: null },
      customerReviewedAt: { type: Date, default: null }
    },

    settlementStatus: {
      type: String,
      enum: ["pending", "awaiting_customer_approval", "pending_payment", "pending_refund", "settled", "refund_failed"],
      default: "pending",
      index: true
    },

    passengerCount: {
      type: Number,
      min: 1,
      default: null
    },

    goods: {
      type: String,
      required: function () {
        return !isPassengerCategory(this.serviceCategory);
      },
      default: function () {
        return isPassengerCategory(this.serviceCategory) ? "Passenger Transportation" : "";
      },
      trim: true
    },

    quantity: {
      type: Number,
      min: 0,
      default: 1
    },

    loadingRequired: {
      type: Boolean,
      default: false
    },

    unloadingRequired: {
      type: Boolean,
      default: false
    },

    loadingInstructions: {
      type: String,
      trim: true,
      default: ""
    },

    unloadingInstructions: {
      type: String,
      trim: true,
      default: ""
    },

    deliveryProofUrl: {
      type: String,
      trim: true,
      default: ""
    },

    deliveryProof: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      uploadedAt: { type: Date, default: null },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },

    pickupArrivedAt: {
      type: Date,
      default: null
    },

    loadedAt: {
      type: Date,
      default: null
    },

    destinationArrivedAt: {
      type: Date,
      default: null
    },

    unloadedAt: {
      type: Date,
      default: null
    },

    weight: {
      value: {
        type: Number,
        required: function () {
          return !isPassengerCategory(this.serviceCategory);
        },
        default: 0,
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
      enum: VEHICLE_TYPES,
      required: true,
      index: true
    },

    estimatedFare: {
      type: Number,
      required: true,
      min: 0,
      immutable: true
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
        "partially_paid",
        "refund_pending",
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
        enum: [
        "initiated",
        "method_changed",
        "order_created",
        "paid",
        "cash_collected",
        "failed",
        "refunded",
        "adjustment_approved",
        "adjustment_rejected",
        "refund_initiated",
        "settlement_updated"
        ],
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

bookingSchema.pre("validate", function validateCategoryVehicleType() {
  const canonical = canonicalizeServiceCategory(this.serviceCategory);
  if (!isValidCategoryVehicleType(this.serviceCategory, this.vehicleType) && !isValidCategoryVehicleType(canonical, this.vehicleType)) {
    this.invalidate("vehicleType", "Vehicle type does not belong to the selected service category");
  }
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;