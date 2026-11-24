import mongoose from "mongoose";
import {
  canonicalizeServiceCategory,
  isPassengerCategory,
  isValidCategoryVehicleType,
  SERVICE_CATEGORIES,
  VEHICLE_TYPES
} from "../utils/vehicleCategories.js";

const vehicleDocumentSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
    status: {
      type: String,
      enum: ["not_uploaded", "pending", "approved", "rejected"],
      default: "not_uploaded"
    },
    submittedAt: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "", trim: true },
    reviewHistory: [{
      previousStatus: { type: String, enum: ["not_uploaded", "pending", "approved", "rejected"] },
      newStatus: { type: String, enum: ["approved", "rejected"], required: true },
      reviewedAt: { type: Date, required: true },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      rejectionReason: { type: String, default: "", trim: true }
    }]
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true
    },

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true
    },

    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    vehicleMake: {
      type: String,
      trim: true,
      default: ""
    },

    vehicleModel: {
      type: String,
      required: true,
      trim: true
    },

    vehicleType: {
      type: String,
      enum: VEHICLE_TYPES,
      required: true,
      index: true
    },

    serviceCategory: {
      type: String,
      enum: Object.values(SERVICE_CATEGORIES),
      default: SERVICE_CATEGORIES.TRUCK,
      index: true
    },

    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "cng", "electric"],
      default: null
    },

    dimensions: {
      lengthCm: { type: Number, min: 0, default: null },
      widthCm: { type: Number, min: 0, default: null },
      heightCm: { type: Number, min: 0, default: null }
    },

    batteryRangeKm: {
      type: Number,
      min: 0,
      default: null
    },

    chargingInformation: {
      type: String,
      trim: true,
      default: ""
    },

    serviceAreas: {
      type: [{ type: String, trim: true }],
      default: []
    },

    seatingCapacity: {
      type: Number,
      min: 1,
      default: null
    },

    isAirConditioned: {
      type: Boolean,
      default: false
    },

    loadCapacity: {
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

    bodyType: {
      type: String,
      enum: [
        "open",
        "closed",
        "container",
        "flatbed"
      ],
      default: "open"
    },

    vehicleImage: {
      type: String,
      default: ""
    },

    vehicleImages: [
      {
        type: String
      }
    ],

    registrationDocument: {
      type: String,
      default: ""
    },

    insuranceDocument: {
      type: String,
      default: ""
    },

    documents: {
      registration: { type: vehicleDocumentSchema, default: () => ({}) },
      insurance: { type: vehicleDocumentSchema, default: () => ({}) }
    },

    isAvailable: {
      type: Boolean,
      default: true,
      index: true
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

vehicleSchema.pre("validate", function validateCategoryVehicleType() {
  const canonical = canonicalizeServiceCategory(this.serviceCategory);
  if (!isValidCategoryVehicleType(this.serviceCategory, this.vehicleType)) {
    this.invalidate("vehicleType", "Vehicle type does not belong to the selected service category");
  }
  const isEV = canonical === SERVICE_CATEGORIES.EV_PASSENGER || this.serviceCategory === SERVICE_CATEGORIES.EV_GOODS;
  if (isEV && this.fuelType !== "electric") {
    const msg = this.serviceCategory === SERVICE_CATEGORIES.EV_GOODS
      ? "EV Goods vehicles must use electric power"
      : "EV Passenger vehicles must use electric power";
    this.invalidate("fuelType", msg);
  }
  if (isEV) {
    if (!Number.isFinite(this.batteryRangeKm) || this.batteryRangeKm <= 0) {
      const msg = this.serviceCategory === SERVICE_CATEGORIES.EV_GOODS
        ? "EV Goods vehicles need a positive battery range"
        : "EV Passenger vehicles need a positive battery range";
      this.invalidate("batteryRangeKm", msg);
    }
    if (!this.chargingInformation?.trim()) {
      const msg = this.serviceCategory === SERVICE_CATEGORIES.EV_GOODS
        ? "EV Goods vehicles need charging information"
        : "EV Passenger vehicles need charging information";
      this.invalidate("chargingInformation", msg);
    }
  }
  const isTaxi = canonical === SERVICE_CATEGORIES.TAXI || this.serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI;
  if (isTaxi && !this.fuelType) {
    const msg = this.serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI
      ? "Goods Taxi vehicles need a supported fuel type"
      : "Taxi vehicles need a supported fuel type";
    this.invalidate("fuelType", msg);
  }
  const isPassenger = isPassengerCategory(this.serviceCategory) || isPassengerCategory(canonical);
  if (isPassenger && this.seatingCapacity !== undefined && this.seatingCapacity !== null) {
    if (!Number.isFinite(this.seatingCapacity) || this.seatingCapacity < 1) {
      this.invalidate("seatingCapacity", "Passenger vehicles must specify a seating capacity of at least 1");
    }
  }
});

vehicleSchema.index(
  { driver: 1 },
  {
    unique: true,
    partialFilterExpression: { driver: { $type: "objectId" }, isActive: true },
    name: "unique_active_vehicle_driver"
  }
);

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
