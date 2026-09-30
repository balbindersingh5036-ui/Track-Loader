import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { emitToUser } from "../sockets/socket.js";

export const createNotification = async ({ recipient, title, message, type = "general", booking = null }) => {
  try {
    const notification = new Notification({
      recipient,
      title,
      message,
      type,
      booking
    });

    await notification.save();
    
    // Emit real-time notification
    emitToUser(recipient, "notification:new", {
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      booking: notification.booking,
      createdAt: notification.createdAt
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null; // Fail gracefully
  }
};

export const notifyCustomer = async (customerId, title, message, bookingId = null) => {
  return createNotification({
    recipient: customerId,
    title,
    message,
    type: "booking",
    booking: bookingId
  });
};

export const notifyDriver = async (driverId, title, message, bookingId = null) => {
  // If driverId is provided, we assume it's the User ID linked to the driver
  return createNotification({
    recipient: driverId,
    title,
    message,
    type: "booking",
    booking: bookingId
  });
};

export const notifyAdmins = async (title, message, bookingId = null) => {
  try {
    const admins = await User.find({ role: "admin", isActive: true });
    for (const admin of admins) {
      await createNotification({
        recipient: admin._id,
        title,
        message,
        type: "system",
        booking: bookingId
      });
    }
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};
