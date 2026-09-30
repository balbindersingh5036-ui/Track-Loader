import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemSetting from "./src/models/SystemSetting.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const settings = await SystemSetting.find({});
    console.log("Total Settings:", settings.length);
    console.log("Settings:", JSON.stringify(settings, null, 2));
    const publicKeys = [
      "booking.enabled",
      "payment.enabled",
      "customer.registrationEnabled",
      "driver.enabled",
      "notification.enabled",
      "system.maintenanceMode",
      "system.supportPhone",
      "system.supportEmail"
    ];
    const pubSettings = await SystemSetting.find({ key: { $in: publicKeys }, isActive: true });
    console.log("Public settings fetched:", pubSettings.length);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
run();
