import mongoose from "mongoose";
import Complaint from "../models/Complaint.js";

const generateTicketId = async () => {
  if (mongoose.connection.readyState !== 1) {
    return `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  try {
    const lastComplaint = await Complaint.findOne(
      { ticketId: { $exists: true, $ne: null } },
      {},
      { sort: { createdAt: -1 } }
    ).select("ticketId");

    if (!lastComplaint || !lastComplaint.ticketId) {
      return "TKT-0001";
    }

    const match = String(lastComplaint.ticketId).match(/TKT-(\d+)/);
    if (match && match[1]) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `TKT-${nextNumber.toString().padStart(4, "0")}`;
    }
  } catch (error) {
    // fallback
  }

  return `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
};

export default generateTicketId;
