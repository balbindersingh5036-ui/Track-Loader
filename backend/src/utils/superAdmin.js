import mongoose from "mongoose";
import { env } from "../config/env.js";

export const isDesignatedSuperAdmin = (user) =>
  Boolean(
    user?.role === "admin" &&
    mongoose.isValidObjectId(env.superAdminUserId) &&
    String(user._id) === String(env.superAdminUserId)
  );

export const isSuperAdminConfigured = () =>
  mongoose.isValidObjectId(env.superAdminUserId);
