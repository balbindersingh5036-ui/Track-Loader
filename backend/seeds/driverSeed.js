
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";

import { hashPassword } from "../src/utils/password.js";

const MONGODB_URI = process.env.MONGODB_URI;

const DRIVER_NAME =
  process.env.SEED_DRIVER_NAME || "Test Driver";
const DRIVER_PHONE =
  process.env.SEED_DRIVER_PHONE || "8888888888";
const DRIVER_EMAIL =
  process.env.SEED_DRIVER_EMAIL || "driver@loadbalbin.com";
const DRIVER_PASSWORD =
  process.env.SEED_DRIVER_PASSWORD || "Driver@12345";

const VEHICLE_NUMBER =
  process.env.SEED_VEHICLE_NUMBER || "UP70AB1234";

const seedDriver = async () => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    await mongoose.connect(MONGODB_URI);

    console.log("MongoDB connected for driver seed");

    const normalizedPhone = DRIVER_PHONE.replace(/\D/g, "");

    let user = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { email: DRIVER_EMAIL.toLowerCase() }
      ]
    });

    if (user) {
      if (user.role !== "driver") {
        throw new Error(
          "A non-driver user already exists with this phone/email."
        );
      }

      console.log("Driver user already exists");
    } else {
      const hashedPassword = await hashPassword(
        DRIVER_PASSWORD
      );

      user = await User.create({
        name: DRIVER_NAME,
        phone: normalizedPhone,
        email: DRIVER_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: "driver",
        isActive: true
      });

      console.log("Driver user created");
    }

    let driver = await Driver.findOne({
      user: user._id
    });

    if (!driver) {
      driver = await Driver.create({
        user: user._id,
        fullName: DRIVER_NAME,
        phone: normalizedPhone,
        email: DRIVER_EMAIL.toLowerCase(),

        approvalStatus: "approved",

        isOnline: false,
        isActive: true,

        rating: 5,
        totalTrips: 0
      });

      console.log("Driver profile created");
    } else {
      console.log("Driver profile already exists");
    }

    let vehicle = await Vehicle.findOne({
      vehicleNumber: VEHICLE_NUMBER.toUpperCase()
    });

    if (!vehicle) {
      vehicle = await Vehicle.create({
        driver: driver._id,

        vehicleNumber: VEHICLE_NUMBER.toUpperCase(),

        vehicleModel: "Tata Ace",

        vehicleType: "mini-truck",

        loadCapacity: {
          value: 750,
          unit: "kg"
        },

        bodyType: "open",

        vehicleImage: "",
        vehicleImages: [],

        registrationDocument: "",
        insuranceDocument: "",

        isAvailable: true,
        isActive: true
      });

      console.log("Driver vehicle created");
    } else {
      console.log("Vehicle already exists");
    }

    console.log("\nDriver seed completed successfully:\n");

    console.log({
      userId: user._id.toString(),
      driverId: driver._id.toString(),
      vehicleId: vehicle._id.toString(),
      phone: user.phone,
      email: user.email,
      role: user.role,
      approvalStatus: driver.approvalStatus,
      vehicleNumber: vehicle.vehicleNumber
    });
  } catch (error) {
    console.error("Driver seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedDriver();