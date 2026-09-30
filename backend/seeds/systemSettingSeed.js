import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemSetting from "../src/models/SystemSetting.js";

dotenv.config();

const defaultSettings = [
  { key: "booking.enabled", value: true, type: "boolean", category: "booking", description: "Enable new customer bookings" },
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
        { $set: setting },
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
