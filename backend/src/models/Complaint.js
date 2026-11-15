import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true
    },

    bookingReference: {
      type: String,
      default: null,
      trim: true,
      index: true
    },

    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    status: {
      type: String,
      enum: [
        "open",
        "in-review",
        "resolved",
        "closed"
      ],
      default: "open",
      index: true
    },

    adminResponse: {
      type: String,
      default: ""
    },

    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

complaintSchema.virtual("bookingNumber").get(function () {
  return this.bookingReference || this.booking?.bookingId || null;
});

const Complaint = mongoose.model(
  "Complaint",
  complaintSchema
);

export default Complaint;
