import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    resourceType: { type: String, default: "image" },
    format: { type: String, default: "" },
    maskedNumber: { type: String, default: "" },
    expiryDate: { type: Date, default: null },
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

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true
    },

    agencyAssociation: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
        index: true
      },
      rejectionReason: {
        type: String,
        default: "",
        trim: true
      },
      decidedAt: {
        type: Date,
        default: null
      },
      decisionAt: {
        type: Date,
        default: null
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      }
    },

    fullName: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    },

    profileImage: {
      type: String,
      default: ""
    },

    address: {
      type: String,
      default: ""
    },

    emergencyContact: {
      name: {
        type: String,
        default: ""
      },
      phone: {
        type: String,
        default: ""
      }
    },

    documents: {
      idProof: { type: documentSchema, default: () => ({}) },
      drivingLicense: { type: documentSchema, default: () => ({}) },
      vehicleRegistration: { type: documentSchema, default: () => ({}) },
      insurance: { type: documentSchema, default: () => ({}) }
    },

    approvalStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "suspended"
      ],
      default: "pending",
      index: true
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true
    },

    isOnline: {
      type: Boolean,
      default: false,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    ratingCount: {
      type: Number,
      default: 0,
      min: 0
    },

    totalTrips: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
