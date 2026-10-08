import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    subtitle: {
      type: String,
      trim: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    mobileImageUrl: {
      type: String
    },
    ctaText: {
      type: String
    },
    ctaAction: {
      type: String
    },
    targetAudience: {
      type: String,
      enum: ["all", "customer", "driver"],
      default: "all"
    },
    serviceType: {
      type: String,
      default: "all"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    }
  },
  { timestamps: true }
);

bannerSchema.index({ isActive: 1 });
bannerSchema.index({ targetAudience: 1 });
bannerSchema.index({ sortOrder: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
