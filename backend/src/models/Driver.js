import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
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
      idProof: {
        url: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        }
      },

      drivingLicense: {
        url: {
          type: String,
          default: ""
        },
        expiryDate: {
          type: Date,
          default: null
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        }
      },

      vehicleRegistration: {
        url: {
          type: String,
          default: ""
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        }
      },

      insurance: {
        url: {
          type: String,
          default: ""
        },
        expiryDate: {
          type: Date,
          default: null
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        }
      }
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
