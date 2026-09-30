import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
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
