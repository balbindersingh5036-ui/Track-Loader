import mongoose from "mongoose";

const agencySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    agencyName: {
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
      lowercase: true,
      default: ""
    },

    address: {
      type: String,
      default: "",
      trim: true
    },

    city: {
      type: String,
      default: "",
      trim: true
    },

    documents: {
      businessRegistration: {
        url: {
          type: String,
          default: ""
        },
        publicId: {
          type: String,
          default: ""
        },
        resourceType: {
          type: String,
          default: "image"
        },
        format: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        submittedAt: { type: Date, default: null },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        rejectionReason: { type: String, default: "", trim: true }
      },

      ownerAadhaar: {
        url: {
          type: String,
          default: ""
        },
        publicId: {
          type: String,
          default: ""
        },
        resourceType: {
          type: String,
          default: "image"
        },
        format: {
          type: String,
          default: ""
        },
        maskedNumber: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        submittedAt: { type: Date, default: null },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        rejectionReason: { type: String, default: "", trim: true }
      },

      taxId: {
        url: {
          type: String,
          default: ""
        },
        publicId: {
          type: String,
          default: ""
        },
        resourceType: {
          type: String,
          default: "image"
        },
        format: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        submittedAt: { type: Date, default: null },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        rejectionReason: { type: String, default: "", trim: true }
      }
    },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true
    },

    rejectionReason: {
      type: String,
      default: ""
    },

    approvedAt: {
      type: Date,
      default: null
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    reviewHistory: [{
      action: {
        type: String,
        enum: ["approved", "rejected", "suspended", "document_approved", "document_rejected"],
        required: true
      },
      documentType: {
        type: String,
        enum: ["ownerAadhaar", "businessRegistration", "taxId"],
        default: null
      },
      reason: { type: String, default: "", trim: true },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      reviewedAt: { type: Date, required: true, default: Date.now }
    }],

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

const Agency = mongoose.model("Agency", agencySchema);

export default Agency;
