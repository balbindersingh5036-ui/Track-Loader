import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemSetting from "../src/models/SystemSetting.js";

dotenv.config();

const defaultSettings = [
  { key: "booking.enabled", value: true, type: "boolean", category: "booking", description: "Enable new customer bookings" },
  { key: "service.ev_goods.enabled", value: false, type: "boolean", category: "booking", description: "Enable EV Goods Transport bookings" },
  { key: "service.goods_taxi.enabled", value: false, type: "boolean", category: "booking", description: "Enable Goods Taxi Transport bookings" },
  { key: "service.ev_goods.allowed_vehicle_types", value: ["electric-cargo-loader", "electric-goods-e-rickshaw", "electric-mini-cargo-carrier"], type: "json", category: "booking", description: "Approved EV Goods vehicle subcategories" },
  { key: "service.goods_taxi.allowed_vehicle_types", value: ["mini-pickup", "tata-ace", "cargo-pickup", "goods-loading-taxi"], type: "json", category: "booking", description: "Approved Goods Taxi vehicle subcategories" },
  { key: "service.ev_goods.max_capacity_kg", value: 0, type: "number", category: "booking", description: "Maximum EV Goods vehicle capacity in kg; 0 means no category limit configured" },
  { key: "service.goods_taxi.max_capacity_kg", value: 0, type: "number", category: "booking", description: "Maximum Goods Taxi vehicle capacity in kg; 0 means no category limit configured" },
  { key: "service.ev_goods.service_areas", value: [], type: "json", category: "booking", description: "Operating areas supported for EV Goods" },
  { key: "service.goods_taxi.service_areas", value: [], type: "json", category: "booking", description: "Operating areas supported for Goods Taxi" },
  { key: "booking.customerCancellationEnabled", value: true, type: "boolean", category: "booking", description: "Allow customers to cancel bookings" },
  { key: "booking.allowCancellationAfterAcceptance", value: false, type: "boolean", category: "booking", description: "Allow cancellation after a driver accepts" },
  { key: "driver.enabled", value: true, type: "boolean", category: "driver", description: "Enable driver operations" },
  { key: "driver.requireApproval", value: true, type: "boolean", category: "driver", description: "Require admin approval for new drivers" },
  { key: "customer.registrationEnabled", value: true, type: "boolean", category: "customer", description: "Allow new customer registrations" },
  { key: "notification.enabled", value: true, type: "boolean", category: "notification", description: "Enable system notifications" },
  { key: "payment.enabled", value: true, type: "boolean", category: "payment", description: "Enable online payments" },
  { key: "fare.enabled", value: true, type: "boolean", category: "fare", description: "Enable fare calculation" },
  { key: "system.maintenanceMode", value: false, type: "boolean", category: "system", description: "Put system in maintenance mode" },
  { key: "system.supportPhone", value: "+1234567890", type: "string", category: "system", description: "Support phone number" },
  { key: "system.supportEmail", value: "support@loadbalbin.com", type: "string", category: "system", description: "Support email address" }
];

const seedSettings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const setting of defaultSettings) {
      await SystemSetting.findOneAndUpdate(
        { key: setting.key },
        setting.key.startsWith("service.")
          ? { $setOnInsert: setting }
          : { $set: setting },
        { upsert: true }
      );
    }
    
    console.log("System settings seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed settings:", error);
    process.exit(1);
  }
};

seedSettings();
