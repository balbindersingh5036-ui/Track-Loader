import Notification from "../models/Notification.js";
import { successResponse, errorResponse } from "../utils/response.js";
import mongoose from "mongoose";
import { parsePagination } from "../utils/pagination.js";

export const getNotifications = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const { unreadOnly } = req.query;
    
    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Notification.countDocuments(query);

    return successResponse(res, { notifications, total, page, pages: Math.ceil(total / limit) }, "Notifications fetched");
  } catch (error) {
    console.error("Get notifications error:", error);
    return errorResponse(res, "Failed to fetch notifications", 500);
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    return successResponse(res, { count }, "Unread count fetched");
  } catch (error) {
    console.error("Get unread count error:", error);
    return errorResponse(res, "Failed to fetch unread count", 500);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid notification ID", 400);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) return errorResponse(res, "Notification not found", 404);

    return successResponse(res, { notification }, "Notification marked as read");
  } catch (error) {
    console.error("Mark read error:", error);
    return errorResponse(res, "Failed to mark notification as read", 500);
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return successResponse(res, null, "All notifications marked as read");
  } catch (error) {
    console.error("Mark all read error:", error);
    return errorResponse(res, "Failed to mark all as read", 500);
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid notification ID", 400);

    const notification = await Notification.findOne({ _id: id, recipient: req.user._id });
    if (!notification) return errorResponse(res, "Notification not found", 404);

    return successResponse(res, { notification }, "Notification fetched");
  } catch (error) {
    console.error("Get notification error:", error);
    return errorResponse(res, "Failed to fetch notification", 500);
  }
};
