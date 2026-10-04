
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

export const ensureAdminUser = async () => {
  try {
    const name = (process.env.SEED_ADMIN_NAME || "LoadBalbin Admin").trim();
    const rawPhone = String(process.env.SEED_ADMIN_PHONE || "9999999999");
    const normalizedPhone = rawPhone.replace(/\D/g, "");
    const normalizedEmail = (process.env.SEED_ADMIN_EMAIL || "admin@loadbalbin.com").trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";

    const matchingUsers = await User.find({
      $or: [
        { phone: normalizedPhone },
        { email: normalizedEmail }
      ]
    }).select("+password");

    if (matchingUsers.length > 1) {
      console.warn("Multiple accounts match configured admin email or phone; skipping auto-creation.");
      return;
    }

    const existingUser = matchingUsers[0];
    if (existingUser) {
      if (existingUser.role !== "admin") {
        console.warn("User already exists with admin email/phone but role is not admin.");
        return;
      }

      const passwordMatches = await comparePassword(
        adminPassword,
        existingUser.password
      );
      const updates = {};
      if (!passwordMatches) {
        updates.password = await hashPassword(adminPassword);
      }
      if (!existingUser.isActive) updates.isActive = true;
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: existingUser._id, role: "admin" }, { $set: updates });
        console.log("Existing admin account safely updated.");
      }
      return;
    }

    const hashedPassword = await hashPassword(adminPassword);

    await User.create({
      name,
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isActive: true
    });

    console.log("Admin account ensured successfully.");
  } catch (error) {
    console.error("Failed to ensure admin account:", error.message);
  }
};

const runStandalone = async () => {
  try {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
      throw new Error("MONGODB_URI missing");
    }
    await mongoose.connect(mongodbUri);
    await ensureAdminUser();
  } catch (err) {
    console.error("Admin seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && process.argv[1].includes("adminSeed.js")) {
  runStandalone();
}