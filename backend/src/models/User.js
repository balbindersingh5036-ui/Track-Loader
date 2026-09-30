import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    role: {
      type: String,
      enum: ["customer", "driver", "admin"],
      default: "customer",
      index: true
    },

    profileImage: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
