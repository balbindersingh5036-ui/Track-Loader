import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import { hashPassword } from "../src/utils/password.js";

// Load environment variables
dotenv.config();

const CUSTOMERS = [
  { name: "Demo Customer 01", email: "demo.customer01@loadbalbin.com", phone: "9000000001" },
  { name: "Demo Customer 02", email: "demo.customer02@loadbalbin.com", phone: "9000000002" },
  { name: "Demo Customer 03", email: "demo.customer03@loadbalbin.com", phone: "9000000003" },
  { name: "Demo Customer 04", email: "demo.customer04@loadbalbin.com", phone: "9000000004" },
  { name: "Demo Customer 05", email: "demo.customer05@loadbalbin.com", phone: "9000000005" },
];

const DRIVERS = [
  { name: "Demo Driver 01", email: "demo.driver01@loadbalbin.com", phone: "9100000001" },
  { name: "Demo Driver 02", email: "demo.driver02@loadbalbin.com", phone: "9100000002" },
  { name: "Demo Driver 03", email: "demo.driver03@loadbalbin.com", phone: "9100000003" },
  { name: "Demo Driver 04", email: "demo.driver04@loadbalbin.com", phone: "9100000004" },
  { name: "Demo Driver 05", email: "demo.driver05@loadbalbin.com", phone: "9100000005" },
];

const VEHICLES = [
  {
    vehicleNumber: "DL01DEMO01",
    vehicleModel: "Tata Ace",
    vehicleType: "mini-truck",
    loadCapacity: { value: 750, unit: "kg" },
    bodyType: "open"
  },
  {
    vehicleNumber: "UP01DEMO02",
    vehicleModel: "Mahindra Bolero Pickup",
    vehicleType: "pickup",
    loadCapacity: { value: 1500, unit: "kg" },
    bodyType: "open"
  },
  {
    vehicleNumber: "UP70DEMO03",
    vehicleModel: "Eicher Pro 2049",
    vehicleType: "small-truck",
    loadCapacity: { value: 2.5, unit: "ton" },
    bodyType: "closed"
  },
  {
    vehicleNumber: "RJ14DEMO04",
    vehicleModel: "Tata 407",
    vehicleType: "medium-truck",
    loadCapacity: { value: 4, unit: "ton" },
    bodyType: "open"
  },
  {
    vehicleNumber: "HR26DEMO05",
    vehicleModel: "Ashok Leyland Dost",
    vehicleType: "mini-truck",
    loadCapacity: { value: 1.25, unit: "ton" },
    bodyType: "container"
  }
];

const DEMO_PASSWORD_PLAIN = "Demo@12345";

const seedDemoData = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in the environment.");
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to database for demo seeding.");

    const hashedPassword = await hashPassword(DEMO_PASSWORD_PLAIN);

    let customersCreated = 0;
    let driversCreated = 0;
    let vehiclesCreated = 0;

    // 1. Seed Customers
    for (const customerData of CUSTOMERS) {
      const existingUser = await User.findOne({ phone: customerData.phone });
      if (existingUser) {
        // Idempotent update
        await User.findByIdAndUpdate(existingUser._id, {
          name: customerData.name,
          email: customerData.email,
          role: "customer",
          isActive: true
        });
      } else {
        await User.create({
          ...customerData,
          password: hashedPassword,
          role: "customer",
          isActive: true
        });
        customersCreated++;
      }
    }

    // 2. Seed Drivers & Vehicles
    for (let i = 0; i < DRIVERS.length; i++) {
      const driverData = DRIVERS[i];
      let user = await User.findOne({ phone: driverData.phone });
      
      if (user) {
        // Idempotent update user
        await User.findByIdAndUpdate(user._id, {
          name: driverData.name,
          email: driverData.email,
          role: "driver",
          isActive: true
        });
      } else {
        user = await User.create({
          ...driverData,
          password: hashedPassword,
          role: "driver",
          isActive: true
        });
      }

      // Seed Driver Profile
      let driver = await Driver.findOne({ user: user._id });
      if (driver) {
        // Idempotent update
        await Driver.findByIdAndUpdate(driver._id, {
          fullName: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          approvalStatus: "approved",
          isOnline: false,
          isActive: true,
          address: "Demo Business Area, Demo City, India"
        });
      } else {
        driver = await Driver.create({
          user: user._id,
          fullName: driverData.name,
          email: driverData.email,
          phone: driverData.phone,
          approvalStatus: "approved",
          isOnline: false,
          isActive: true,
          address: "Demo Business Area, Demo City, India"
        });
        driversCreated++;
      }

      // 3. Seed Vehicles
      const vehicleData = VEHICLES[i];
      let vehicle = await Vehicle.findOne({ vehicleNumber: vehicleData.vehicleNumber });
      if (vehicle) {
        // Idempotent update
        await Vehicle.findByIdAndUpdate(vehicle._id, {
          ...vehicleData,
          driver: driver._id,
          isAvailable: true,
          isActive: true
        });
      } else {
        await Vehicle.create({
          ...vehicleData,
          driver: driver._id,
          isAvailable: true,
          isActive: true
        });
        vehiclesCreated++;
      }
    }

    console.log(`Demo Data Seeding Complete.`);
    console.log(`Customers created/verified: ${CUSTOMERS.length} (New: ${customersCreated})`);
    console.log(`Drivers created/verified: ${DRIVERS.length} (New: ${driversCreated})`);
    console.log(`Vehicles created/verified: ${VEHICLES.length} (New: ${vehiclesCreated})`);

  } catch (error) {
    console.error("Demo seeding failed:", error);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from database.");
  }
};

seedDemoData();
