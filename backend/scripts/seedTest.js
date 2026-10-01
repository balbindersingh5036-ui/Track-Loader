import mongoose from "mongoose";
import { hashPassword } from "../src/utils/password.js";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import Fare from "../src/models/Fare.js";
import SystemSetting from "../src/models/SystemSetting.js";
import { loadTestEnvironment } from "./testDatabaseSafety.js";

const settings = [
  { key: "booking.enabled", value: true, type: "boolean", category: "booking" },
  { key: "booking.customerCancellationEnabled", value: true, type: "boolean", category: "booking" },
  { key: "booking.allowCancellationAfterAcceptance", value: false, type: "boolean", category: "booking" },
  { key: "driver.enabled", value: true, type: "boolean", category: "driver" },
  { key: "driver.requireApproval", value: true, type: "boolean", category: "driver" },
  { key: "customer.registrationEnabled", value: true, type: "boolean", category: "customer" },
  { key: "notification.enabled", value: true, type: "boolean", category: "notification" },
  { key: "payment.enabled", value: true, type: "boolean", category: "payment" },
  { key: "fare.enabled", value: true, type: "boolean", category: "fare" },
  { key: "system.maintenanceMode", value: false, type: "boolean", category: "system" },
  { key: "system.supportPhone", value: "5550100000", type: "string", category: "system" },
  { key: "system.supportEmail", value: "support@example.invalid", type: "string", category: "system" }
];

const upsertTestUser = async ({ email, password, role, phone, name }) => {
  const matches = await User.find({
    $or: [{ email }, { phone }]
  }).select("+password");
  if (matches.some((user) => user.role !== role)) {
    throw new Error(`A test identity is already assigned to a different role (${role}).`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple test identities match the configured ${role} identity.`);
  }

  const user = matches[0] || new User({ email, phone, name, role });
  user.name = name;
  user.email = email;
  user.phone = phone;
  user.role = role;
  user.isActive = true;
  user.password = await hashPassword(password);
  await user.save();
  return user;
};

const seed = async () => {
  let connected = false;
  try {
    const config = loadTestEnvironment();
    await mongoose.connect(config.uri);
    connected = true;

    const identities = [
      {
        name: "Isolated Test Admin",
        email: config.adminEmail,
        password: config.adminPassword,
        role: "admin",
        phone: "5550100001"
      },
      {
        name: "Isolated Test Customer",
        email: config.customerEmail,
        password: config.customerPassword,
        role: "customer",
        phone: "5550100002"
      },
      {
        name: "Isolated Test Driver",
        email: config.driverEmail,
        password: config.driverPassword,
        role: "driver",
        phone: "5550100003"
      }
    ];

    const users = {};
    for (const identity of identities) {
      users[identity.role] = await upsertTestUser(identity);
    }

    const driver = await Driver.findOneAndUpdate(
      { user: users.driver._id },
      {
        $set: {
          fullName: identities[2].name,
          phone: identities[2].phone,
          email: identities[2].email,
          approvalStatus: "approved",
          isOnline: false,
          isActive: true
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    await Vehicle.findOneAndUpdate(
      { vehicleNumber: "TEST000001" },
      {
        $set: {
          driver: driver._id,
          vehicleModel: "Test Vehicle",
          vehicleType: "mini-truck",
          loadCapacity: { value: 1000, unit: "kg" },
          bodyType: "open",
          isAvailable: true,
          isActive: true
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    await Fare.findOneAndUpdate(
      { vehicleType: "mini-truck" },
      {
        $set: {
          baseFare: 100,
          perKmRate: 10,
          perTonRate: 50,
          minimumFare: 100,
          loadingCharge: 0,
          unloadingCharge: 0,
          isActive: true
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    for (const setting of settings) {
      await SystemSetting.findOneAndUpdate(
        { key: setting.key },
        { $set: { ...setting, isActive: true } },
        { upsert: true, runValidators: true }
      );
    }

    const publicConfigKeys = [
      "booking.enabled",
      "payment.enabled",
      "customer.registrationEnabled",
      "driver.enabled",
      "notification.enabled",
      "system.maintenanceMode",
      "system.supportPhone",
      "system.supportEmail"
    ];
    const publicConfigCount = await SystemSetting.countDocuments({
      key: { $in: publicConfigKeys },
      isActive: true
    });
    if (publicConfigCount !== publicConfigKeys.length) {
      throw new Error("The isolated test database does not contain all public settings.");
    }

    console.log(
      `Isolated test seed complete: 3 users (admin/customer/driver), 1 approved driver, 1 vehicle, 1 fare, ${settings.length} settings.`
    );
  } catch (error) {
    console.error(`Test seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (connected) await mongoose.disconnect();
  }
};

seed();
