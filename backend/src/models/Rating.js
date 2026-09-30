import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
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
      required: true,
      index: true
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    feedback: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

const Rating = mongoose.model("Rating", ratingSchema);

export default Rating;