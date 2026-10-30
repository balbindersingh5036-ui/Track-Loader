import mongoose from "mongoose";
import { env } from "../config/env.js";

export const getSuperAdminUserId = () => {
  const raw = process.env.SUPER_ADMIN_USER_ID ?? env?.superAdminUserId ?? "";
  const cleaned = String(raw).trim().replace(/^["']|["']$/g, "").trim();
  if (cleaned === "undefined" || cleaned === "null") return "";
  return cleaned;
};

export const isSuperAdminConfigured = () => {
  const configuredId = getSuperAdminUserId();
  return mongoose.isValidObjectId(configuredId);
};

export const isDesignatedSuperAdmin = (user) => {
  if (!user || user.role !== "admin") return false;
  const configuredId = getSuperAdminUserId();
  if (!mongoose.isValidObjectId(configuredId)) return false;

  const userId = String(user._id || user.id || "").trim();
  return Boolean(userId && userId === configuredId);
};
