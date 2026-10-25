import mongoose from "mongoose";

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
    rejectionReason: { type: String, default: "", trim: true }
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

    vehicleModel: {
      type: String,
      required: true,
      trim: true
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

    loadCapacity: {
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

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
