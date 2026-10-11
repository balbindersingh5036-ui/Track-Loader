import mongoose from "mongoose";
import dotenv from "dotenv";
import "../src/ipv4.js";
import Fare from "../src/models/Fare.js";

dotenv.config();

export const defaultFares = [
  {
    vehicleType: "mini-truck",
    baseFare: 150,
    perKmRate: 15,
    perTonRate: 50,
    minimumFare: 200,
    loadingCharge: 50,
    unloadingCharge: 50,
    isActive: true
  },
  {
    vehicleType: "pickup",
    baseFare: 200,
    perKmRate: 18,
    perTonRate: 60,
    minimumFare: 250,
    loadingCharge: 60,
    unloadingCharge: 60,
    isActive: true
  },
  {
    vehicleType: "small-truck",
    baseFare: 300,
    perKmRate: 22,
    perTonRate: 80,
    minimumFare: 350,
    loadingCharge: 100,
    unloadingCharge: 100,
    isActive: true
  },
  {
    vehicleType: "medium-truck",
    baseFare: 500,
    perKmRate: 28,
    perTonRate: 100,
    minimumFare: 600,
    loadingCharge: 150,
    unloadingCharge: 150,
    isActive: true
  },
  {
    vehicleType: "large-truck",
    baseFare: 800,
    perKmRate: 35,
    perTonRate: 120,
    minimumFare: 1000,
    loadingCharge: 200,
    unloadingCharge: 200,
    isActive: true
  }
];

export async function seedFares() {
  let isConnected = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      isConnected = true;
      console.log("Connected to MongoDB for fare seeding");
    }

    for (const fare of defaultFares) {
      await Fare.findOneAndUpdate(
        { vehicleType: fare.vehicleType },
        { $set: fare },
        { upsert: true }
      );
      console.log(`Seeded fare for ${fare.vehicleType}`);
    }

    console.log("All fares seeded successfully");
    return defaultFares;
  } catch (err) {
    console.error("Failed to seed fares:", err);
    throw err;
  } finally {
    if (isConnected) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && process.argv[1].includes("fareSeed.js")) {
  seedFares()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
