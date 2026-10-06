import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();

const CUSTOMERS = [
  { name: "Amit Sharma", email: "amit.sharma@loadbalbin.com", phone: "9001000001" },
  { name: "Rahul Verma", email: "rahul.verma@loadbalbin.com", phone: "9001000002" },
  { name: "Saurabh Gupta", email: "saurabh.gupta@loadbalbin.com", phone: "9001000003" },
  { name: "Neeraj Singh", email: "neeraj.singh@loadbalbin.com", phone: "9001000004" },
  { name: "Ankit Yadav", email: "ankit.yadav@loadbalbin.com", phone: "9001000005" }
];

const DRIVERS = [
  {
    name: "Rakesh Kumar",
    email: "rakesh.kumar@loadbalbin.com",
    phone: "9101000001",
    address: "Civil Lines, Prayagraj, UP - 211001",
    vehicle: {
      vehicleNumber: "UP70BT4521",
      vehicleModel: "Tata Ace",
      vehicleType: "mini-truck",
      loadCapacity: { value: 750, unit: "kg" },
      bodyType: "open"
    }
  },
  {
    name: "Mohit Singh",
    email: "mohit.singh@loadbalbin.com",
    phone: "9101000002",
    address: "Hazratganj, Lucknow, UP - 226001",
    vehicle: {
      vehicleNumber: "UP70CT6812",
      vehicleModel: "Mahindra Bolero Pickup",
      vehicleType: "pickup",
      loadCapacity: { value: 1250, unit: "kg" },
      bodyType: "open"
    }
  },
  {
    name: "Deepak Verma",
    email: "deepak.verma@loadbalbin.com",
    phone: "9101000003",
    address: "Govind Nagar, Kanpur, UP - 208006",
    vehicle: {
      vehicleNumber: "UP70DT9245",
      vehicleModel: "Ashok Leyland Dost",
      vehicleType: "small-truck",
      loadCapacity: { value: 1500, unit: "kg" },
      bodyType: "open"
    }
  },
  {
    name: "Manoj Yadav",
    email: "manoj.yadav@loadbalbin.com",
    phone: "9101000004",
    address: "Sigra, Varanasi, UP - 221002",
    vehicle: {
      vehicleNumber: "UP70ET3178",
      vehicleModel: "Tata 407",
      vehicleType: "medium-truck",
      loadCapacity: { value: 2500, unit: "kg" },
      bodyType: "open"
    }
  },
  {
    name: "Pankaj Gupta",
    email: "pankaj.gupta@loadbalbin.com",
    phone: "9101000005",
    address: "Golghar, Gorakhpur, UP - 273001",
    vehicle: {
      vehicleNumber: "UP70FT5836",
      vehicleModel: "Eicher Pro",
      vehicleType: "large-truck",
      loadCapacity: { value: 5000, unit: "kg" },
      bodyType: "closed"
    }
  }
];

const REAL_PASSWORD_PLAIN = "Real@12345";

export const seedRealData = async () => {
  let isConnected = false;
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in the environment.");
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
      console.log("Connected to MongoDB for real data seeding.");
    }

    // ==========================================
    // STEP 1: CLEAN UP TARGETED DEMO / TEST DATA
    // Only target records matching demo/test patterns:
    // E2E_TEST_, demo.customer, demo.driver, Demo Customer, Demo Driver, DEMO vehicle numbers
    // and legacy demo seed phones: 9000000001-9000000005, 9100000001-9100000005
    // ==========================================
    const demoUserFilter = {
      $or: [
        { email: { $regex: /demo\.(customer|driver)/i } },
        { email: { $regex: /^E2E_TEST_/i } },
        { name: { $regex: /^Demo (Customer|Driver)/i } },
        { name: { $regex: /^E2E_TEST_/i } },
        { phone: { $in: [
          "9000000001", "9000000002", "9000000003", "9000000004", "9000000005",
          "9100000001", "9100000002", "9100000003", "9100000004", "9100000005"
        ] } }
      ]
    };

    const demoUsers = await User.find(demoUserFilter);
    const demoUserIds = demoUsers.map((u) => u._id);

    // Delete associated demo drivers
    const demoDriverFilter = {
      $or: [
        { user: { $in: demoUserIds } },
        { email: { $regex: /demo\.driver/i } },
        { fullName: { $regex: /^Demo Driver/i } },
        { phone: { $in: ["9100000001", "9100000002", "9100000003", "9100000004", "9100000005"] } }
      ]
    };
    const demoDrivers = await Driver.find(demoDriverFilter);
    const demoDriverIds = demoDrivers.map((d) => d._id);

    // Delete associated demo vehicles
    const demoVehicleFilter = {
      $or: [
        { driver: { $in: demoDriverIds } },
        { vehicleNumber: { $regex: /DEMO/i } },
        { vehicleNumber: { $regex: /^E2E_TEST_/i } },
        { vehicleNumber: { $in: ["DL01DEMO01", "UP01DEMO02", "UP70DEMO03", "RJ14DEMO04", "HR26DEMO05"] } }
      ]
    };

    const deletedVehicles = await Vehicle.deleteMany(demoVehicleFilter);
    const deletedDrivers = await Driver.deleteMany(demoDriverFilter);
    const deletedUsers = await User.deleteMany(demoUserFilter);

    console.log(`Cleaned up old demo records: ${deletedUsers.deletedCount} users, ${deletedDrivers.deletedCount} drivers, ${deletedVehicles.deletedCount} vehicles.`);

    // ==========================================
    // STEP 2: SEED PRODUCTION-STYLE REAL CUSTOMERS
    // ==========================================
    const hashedPassword = await hashPassword(REAL_PASSWORD_PLAIN);

    let customersCreated = 0;
    let customersUpdated = 0;

    for (const cust of CUSTOMERS) {
      const existingUser = await User.findOne({
        $or: [{ phone: cust.phone }, { email: cust.email.toLowerCase() }]
      });

      if (existingUser) {
        existingUser.name = cust.name;
        existingUser.email = cust.email.toLowerCase();
        existingUser.phone = cust.phone;
        existingUser.role = "customer";
        existingUser.isActive = true;
        existingUser.password = hashedPassword;
        await existingUser.save();
        customersUpdated++;
      } else {
        await User.create({
          name: cust.name,
          email: cust.email.toLowerCase(),
          phone: cust.phone,
          password: hashedPassword,
          role: "customer",
          isActive: true
        });
        customersCreated++;
      }
    }

    // ==========================================
    // STEP 3: SEED PRODUCTION-STYLE REAL DRIVERS & VEHICLES
    // ==========================================
    let driversCreated = 0;
    let driversUpdated = 0;
    let vehiclesCreated = 0;
    let vehiclesUpdated = 0;

    for (const driverItem of DRIVERS) {
      let user = await User.findOne({
        $or: [{ phone: driverItem.phone }, { email: driverItem.email.toLowerCase() }]
      });

      if (user) {
        user.name = driverItem.name;
        user.email = driverItem.email.toLowerCase();
        user.phone = driverItem.phone;
        user.role = "driver";
        user.isActive = true;
        user.password = hashedPassword;
        await user.save();
        driversUpdated++;
      } else {
        user = await User.create({
          name: driverItem.name,
          email: driverItem.email.toLowerCase(),
          phone: driverItem.phone,
          password: hashedPassword,
          role: "driver",
          isActive: true
        });
        driversCreated++;
      }

      // Upsert Driver Profile
      let driverProfile = await Driver.findOne({ user: user._id });
      if (!driverProfile) {
        driverProfile = await Driver.findOne({ phone: driverItem.phone });
      }

      const driverDocData = {
        user: user._id,
        fullName: driverItem.name,
        email: driverItem.email.toLowerCase(),
        phone: driverItem.phone,
        address: driverItem.address,
        approvalStatus: "approved",
        isOnline: true,
        isActive: true,
        documents: {
          idProof: {
            url: "https://images.unsplash.com/photo-idproof-real",
            status: "approved"
          },
          drivingLicense: {
            url: "https://images.unsplash.com/photo-dl-real",
            status: "approved"
          },
          vehicleRegistration: {
            url: "https://images.unsplash.com/photo-rc-real",
            status: "approved"
          },
          insurance: {
            url: "https://images.unsplash.com/photo-ins-real",
            status: "approved"
          }
        }
      };

      if (driverProfile) {
        Object.assign(driverProfile, driverDocData);
        await driverProfile.save();
      } else {
        driverProfile = await Driver.create(driverDocData);
      }

      // Upsert Vehicle
      const vData = driverItem.vehicle;
      let vehicle = await Vehicle.findOne({ vehicleNumber: vData.vehicleNumber.toUpperCase() });

      const vehicleDocData = {
        driver: driverProfile._id,
        vehicleNumber: vData.vehicleNumber.toUpperCase(),
        vehicleModel: vData.vehicleModel,
        vehicleType: vData.vehicleType,
        loadCapacity: vData.loadCapacity,
        bodyType: vData.bodyType || "open",
        isAvailable: true,
        isActive: true
      };

      if (vehicle) {
        Object.assign(vehicle, vehicleDocData);
        await vehicle.save();
        vehiclesUpdated++;
      } else {
        await Vehicle.create(vehicleDocData);
        vehiclesCreated++;
      }
    }

    console.log("-----------------------------------------");
    console.log("Real Data Seeding Summary:");
    console.log(`Customers total: ${CUSTOMERS.length} (Created: ${customersCreated}, Updated: ${customersUpdated})`);
    console.log(`Drivers total: ${DRIVERS.length} (Created: ${driversCreated}, Updated: ${driversUpdated})`);
    console.log(`Vehicles total: ${DRIVERS.length} (Created: ${vehiclesCreated}, Updated: ${vehiclesUpdated})`);
    console.log("-----------------------------------------");

    return {
      customers: { total: CUSTOMERS.length, created: customersCreated, updated: customersUpdated },
      drivers: { total: DRIVERS.length, created: driversCreated, updated: driversUpdated },
      vehicles: { total: DRIVERS.length, created: vehiclesCreated, updated: vehiclesUpdated },
      cleaned: { users: deletedUsers.deletedCount, drivers: deletedDrivers.deletedCount, vehicles: deletedVehicles.deletedCount }
    };
  } catch (error) {
    console.error("Real data seeding failed:", error.message);
    throw error;
  } finally {
    if (isConnected) {
      await mongoose.disconnect();
      console.log("Disconnected from database.");
    }
  }
};

if (process.argv[1] && process.argv[1].includes("seedRealData.js")) {
  seedRealData().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
