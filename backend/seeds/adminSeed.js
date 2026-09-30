
import mongoose from "mongoose";

import User from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

const MONGODB_URI = process.env.MONGODB_URI;

const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "LoadBalbin Admin";
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE || "9999999999";
const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL || "admin@loadbalbin.com";
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

const seedAdmin = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    await mongoose.connect(MONGODB_URI);

    console.log("MongoDB connected for admin seed");

    const normalizedPhone = ADMIN_PHONE.replace(/\D/g, "");

    const existingAdmin = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { email: ADMIN_EMAIL.toLowerCase() }
      ]
    }).select("+password");

    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        throw new Error(
          "A non-admin user already exists with this phone/email."
        );
      }

      console.log("Admin already exists:");
      console.log({
        id: existingAdmin._id.toString(),
        phone: existingAdmin.phone,
        email: existingAdmin.email,
        role: existingAdmin.role
      });

      return;
    }

    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    const admin = await User.create({
      name: ADMIN_NAME,
      phone: normalizedPhone,
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      isActive: true
    });

    console.log("Admin created successfully:");
    console.log({
      id: admin._id.toString(),
      name: admin.name,
      phone: admin.phone,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();