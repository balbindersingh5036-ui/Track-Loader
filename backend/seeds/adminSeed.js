
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import User from "../src/models/User.js";
import { comparePassword, hashPassword } from "../src/utils/password.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  override: true,
  quiet: true
});

const MONGODB_URI = process.env.MONGODB_URI;

const requiredSeedVariables = [
  "SEED_ADMIN_NAME",
  "SEED_ADMIN_PHONE",
  "SEED_ADMIN_EMAIL",
  "SEED_ADMIN_PASSWORD"
];

const seedAdmin = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }
    const missingVariables = requiredSeedVariables.filter((key) => !process.env[key]);
    if (missingVariables.length) {
      throw new Error(`Missing required admin seed configuration: ${missingVariables.join(", ")}`);
    }

    await mongoose.connect(MONGODB_URI);

    console.log("MongoDB connected for admin seed");

    const normalizedPhone = process.env.SEED_ADMIN_PHONE.replace(/\D/g, "");
    const normalizedEmail = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();

    const matchingUsers = await User.find({
      $or: [
        { phone: normalizedPhone },
        { email: normalizedEmail }
      ]
    }).select("+password");

    if (matchingUsers.length > 1) {
      throw new Error("Multiple accounts match the configured admin email or phone; refusing to modify or create accounts.");
    }

    const existingUser = matchingUsers[0];
    if (existingUser) {
      if (existingUser.role !== "admin") {
        throw new Error(
          "A non-admin user already exists with this phone/email."
        );
      }

      const passwordMatches = await comparePassword(
        process.env.SEED_ADMIN_PASSWORD,
        existingUser.password
      );
      const updates = {};
      if (!passwordMatches) {
        updates.password = await hashPassword(process.env.SEED_ADMIN_PASSWORD);
      }
      if (!existingUser.isActive) updates.isActive = true;
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: existingUser._id, role: "admin" }, { $set: updates });
        console.log("Existing admin account was safely updated.");
      } else {
        console.log("Existing admin account already matches the configured credentials.");
      }
      return;
    }

    const hashedPassword = await hashPassword(process.env.SEED_ADMIN_PASSWORD);

    const admin = await User.create({
      name: process.env.SEED_ADMIN_NAME.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isActive: true
    });

    console.log("Admin account created successfully.");
  } catch (error) {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv.includes("--help")) {
  console.log("Usage: npm run seed:admin");
} else {
  seedAdmin();
}