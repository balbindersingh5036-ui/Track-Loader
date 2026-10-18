import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import axios from "axios";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";

async function run() {
  await mongoose.connect(env.mongodbUri);
  const hash = await bcrypt.hash("Password@123", 10);
  const u = await User.findOne({ phone: "7839213358" });
  if (u) {
    u.password = hash;
    await u.save();
    console.log("Updated password for customer 7839213358");
  }
  await mongoose.disconnect();

  const loginRes = await axios.post("https://track-loader.onrender.com/api/auth/login", {
    phone: "7839213358",
    password: "Password@123"
  });
  console.log("Render login success:", loginRes.data.success);
  const token = loginRes.data.data.token;

  try {
    const orderRes = await axios.post("https://track-loader.onrender.com/api/payments/create-order", {
      bookingId: "6ad4dc5e59d8e3d50fe0e331"
    }, {
      headers: { Authorization: "Bearer " + token }
    });
    console.log("Render create-order SUCCESS:", orderRes.status, orderRes.data);
  } catch (err) {
    console.log("Render create-order ERROR status:", err.response?.status);
    console.log("Render create-order ERROR body:", JSON.stringify(err.response?.data));
  }
}

run().catch(console.error);
