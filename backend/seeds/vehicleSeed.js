import mongoose from "mongoose";
import dotenv from "dotenv";
import "../src/ipv4.js";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();

// Legitimate Cloudinary CDN vehicle images uploaded & verified
export const VEHICLE_ASSETS = {
  miniTruck: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705459/loadbalbin_vehicles/tata_ace_mini_truck.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705460/loadbalbin_vehicles/tata_ace_gallery_1.jpg"
    ]
  },
  pickup: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705464/loadbalbin_vehicles/mahindra_bolero_pickup.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705464/loadbalbin_vehicles/mahindra_bolero_pickup.jpg"
    ]
  },
  smallTruck: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705465/loadbalbin_vehicles/ashok_leyland_dost.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705469/loadbalbin_vehicles/ashok_leyland_gallery_1.jpg"
    ]
  },
  mediumTruck: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705471/loadbalbin_vehicles/tata_407_medium_truck.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705473/loadbalbin_vehicles/tata_407_gallery_1.jpg"
    ]
  },
  heavyTruck: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705475/loadbalbin_vehicles/eicher_pro_heavy_truck.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705477/loadbalbin_vehicles/eicher_heavy_gallery_1.jpg"
    ]
  },
  containerTruck: {
    hero: "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705479/loadbalbin_vehicles/container_truck_large.jpg",
    gallery: [
      "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705480/loadbalbin_vehicles/container_truck_gallery_1.jpg"
    ]
  }
};

const SEED_VEHICLES = [
  {
    driverPhone: "9101000001",
    driverName: "Rakesh Kumar",
    driverEmail: "rakesh.kumar@loadbalbin.com",
    address: "Civil Lines, Prayagraj, UP - 211001",
    vehicleNumber: "UP70BT4521",
    vehicleModel: "Tata Ace Gold",
    vehicleType: "mini-truck",
    bodyType: "open",
    loadCapacity: { value: 750, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.miniTruck.hero,
    vehicleImages: VEHICLE_ASSETS.miniTruck.gallery
  },
  {
    driverPhone: "9101000002",
    driverName: "Mohit Singh",
    driverEmail: "mohit.singh@loadbalbin.com",
    address: "Hazratganj, Lucknow, UP - 226001",
    vehicleNumber: "UP70CT6812",
    vehicleModel: "Mahindra Bolero Maxi Truck",
    vehicleType: "pickup",
    bodyType: "open",
    loadCapacity: { value: 1250, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.pickup.hero,
    vehicleImages: VEHICLE_ASSETS.pickup.gallery
  },
  {
    driverPhone: "9101000003",
    driverName: "Deepak Verma",
    driverEmail: "deepak.verma@loadbalbin.com",
    address: "Govind Nagar, Kanpur, UP - 208006",
    vehicleNumber: "UP70DT9245",
    vehicleModel: "Ashok Leyland Dost+",
    vehicleType: "small-truck",
    bodyType: "open",
    loadCapacity: { value: 1500, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.smallTruck.hero,
    vehicleImages: VEHICLE_ASSETS.smallTruck.gallery
  },
  {
    driverPhone: "9101000004",
    driverName: "Manoj Yadav",
    driverEmail: "manoj.yadav@loadbalbin.com",
    address: "Sigra, Varanasi, UP - 221002",
    vehicleNumber: "UP70ET3178",
    vehicleModel: "Tata 407 Gold SFC",
    vehicleType: "medium-truck",
    bodyType: "open",
    loadCapacity: { value: 2500, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.mediumTruck.hero,
    vehicleImages: VEHICLE_ASSETS.mediumTruck.gallery
  },
  {
    driverPhone: "9101000005",
    driverName: "Pankaj Gupta",
    driverEmail: "pankaj.gupta@loadbalbin.com",
    address: "Golghar, Gorakhpur, UP - 273001",
    vehicleNumber: "UP70FT5836",
    vehicleModel: "Eicher Pro 3015 Heavy Truck",
    vehicleType: "large-truck",
    bodyType: "closed",
    loadCapacity: { value: 5000, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.heavyTruck.hero,
    vehicleImages: VEHICLE_ASSETS.heavyTruck.gallery
  },
  {
    driverPhone: "9101000006",
    driverName: "Vikram Sharma",
    driverEmail: "vikram.sharma@loadbalbin.com",
    address: "Transport Nagar, Kanpur, UP - 208023",
    vehicleNumber: "UP70GT7249",
    vehicleModel: "BharatBenz 1617R Container Truck",
    vehicleType: "large-truck",
    bodyType: "container",
    loadCapacity: { value: 10000, unit: "kg" },
    vehicleImage: VEHICLE_ASSETS.containerTruck.hero,
    vehicleImages: VEHICLE_ASSETS.containerTruck.gallery
  }
];

export const seedVehicles = async () => {
  let isConnected = false;
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI missing in environment");

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri);
      isConnected = true;
    }

    console.log("Connected to MongoDB:", mongoose.connection.name);

    const defaultPasswordHash = await hashPassword("Real@12345");
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of SEED_VEHICLES) {
      // 1. Ensure user exists
      let user = await User.findOne({
        $or: [{ phone: item.driverPhone }, { email: item.driverEmail }]
      });

      if (!user) {
        user = await User.create({
          name: item.driverName,
          phone: item.driverPhone,
          email: item.driverEmail,
          password: defaultPasswordHash,
          role: "driver",
          isActive: true
        });
        console.log(`Created driver user: ${item.driverName} (${item.driverPhone})`);
      }

      // 2. Ensure driver profile exists
      let driver = await Driver.findOne({ user: user._id });
      if (!driver) {
        driver = await Driver.findOne({ phone: item.driverPhone });
      }

      const driverData = {
        user: user._id,
        fullName: item.driverName,
        email: item.driverEmail,
        phone: item.driverPhone,
        address: item.address,
        approvalStatus: "approved",
        isOnline: true,
        isActive: true,
        rating: 5,
        ratingCount: 1,
        totalTrips: 12
      };

      if (!driver) {
        driver = await Driver.create(driverData);
        console.log(`Created driver profile: ${item.driverName}`);
      } else {
        Object.assign(driver, driverData);
        await driver.save();
      }

      // 3. Upsert Vehicle
      const vNumber = item.vehicleNumber.toUpperCase();
      let vehicle = await Vehicle.findOne({ vehicleNumber: vNumber });

      const vehicleData = {
        driver: driver._id,
        vehicleNumber: vNumber,
        vehicleModel: item.vehicleModel,
        vehicleType: item.vehicleType,
        bodyType: item.bodyType,
        loadCapacity: item.loadCapacity,
        vehicleImage: item.vehicleImage,
        vehicleImages: item.vehicleImages,
        isAvailable: true,
        isActive: true
      };

      if (!vehicle) {
        vehicle = await Vehicle.create(vehicleData);
        addedCount++;
        console.log(`[CREATED] ${item.vehicleModel} (${vNumber}) [${item.vehicleType}]`);
      } else {
        Object.assign(vehicle, vehicleData);
        await vehicle.save();
        updatedCount++;
        console.log(`[UPDATED] ${item.vehicleModel} (${vNumber}) [${item.vehicleType}] with photos`);
      }
    }

    // Also update any secondary/test vehicles to have photos
    const secondaryUpdates = [
      {
        number: "UP70AB1234",
        model: "Tata Ace",
        img: VEHICLE_ASSETS.miniTruck.hero,
        imgs: VEHICLE_ASSETS.miniTruck.gallery
      },
      {
        number: "DL01TB1000",
        model: "Tata Ace Mini Truck",
        img: VEHICLE_ASSETS.miniTruck.hero,
        imgs: VEHICLE_ASSETS.miniTruck.gallery
      },
      {
        number: "DL01TB1001",
        model: "Mahindra Bolero Pickup",
        img: VEHICLE_ASSETS.pickup.hero,
        imgs: VEHICLE_ASSETS.pickup.gallery
      },
      {
        number: "DL01TB1002",
        model: "Ashok Leyland Dost",
        img: VEHICLE_ASSETS.smallTruck.hero,
        imgs: VEHICLE_ASSETS.smallTruck.gallery
      },
      {
        number: "DL01TB1003",
        model: "Tata 407 Medium Truck",
        img: VEHICLE_ASSETS.mediumTruck.hero,
        imgs: VEHICLE_ASSETS.mediumTruck.gallery
      },
      {
        number: "DL01TB1004",
        model: "Eicher Pro Heavy Truck",
        img: VEHICLE_ASSETS.heavyTruck.hero,
        imgs: VEHICLE_ASSETS.heavyTruck.gallery
      }
    ];

    for (const sec of secondaryUpdates) {
      const v = await Vehicle.findOne({ vehicleNumber: sec.number });
      if (v) {
        v.vehicleModel = sec.model;
        v.vehicleImage = sec.img;
        v.vehicleImages = sec.imgs;
        await v.save();
        console.log(`[SYNCED PHOTOS] Existing vehicle ${sec.number}`);
      }
    }

    const totalVehicles = await Vehicle.countDocuments();
    const vehiclesWithPhotos = await Vehicle.countDocuments({
      vehicleImage: { $exists: true, $ne: "" }
    });

    console.log("-----------------------------------------");
    console.log("Vehicle Seeding Summary:");
    console.log(`Records Added: ${addedCount}`);
    console.log(`Records Updated: ${updatedCount}`);
    console.log(`Total Vehicles in DB: ${totalVehicles}`);
    console.log(`Vehicles with Photos: ${vehiclesWithPhotos}`);
    console.log("-----------------------------------------");

    return { addedCount, updatedCount, totalVehicles, vehiclesWithPhotos };
  } catch (error) {
    console.error("Vehicle seed failed:", error);
    throw error;
  } finally {
    if (isConnected) {
      await mongoose.disconnect();
    }
  }
};

if (process.argv[1] && process.argv[1].includes("vehicleSeed.js")) {
  seedVehicles()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
