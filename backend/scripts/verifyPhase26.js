import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";

dotenv.config();

const runVerification = async () => {
  let isConnected = false;
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
    }

    console.log("=== PHASE 26 VERIFICATION START ===");

    // 1. Check cleanup of old demo/test records
    const remainingDemoUsers = await User.countDocuments({
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
    });

    const remainingDemoDrivers = await Driver.countDocuments({
      $or: [
        { email: { $regex: /demo\.driver/i } },
        { fullName: { $regex: /^Demo Driver/i } },
        { phone: { $in: ["9100000001", "9100000002", "9100000003", "9100000004", "9100000005"] } }
      ]
    });

    const remainingDemoVehicles = await Vehicle.countDocuments({
      $or: [
        { vehicleNumber: { $regex: /DEMO/i } },
        { vehicleNumber: { $regex: /^E2E_TEST_/i } },
        { vehicleNumber: { $in: ["DL01DEMO01", "UP01DEMO02", "UP70DEMO03", "RJ14DEMO04", "HR26DEMO05"] } }
      ]
    });

    console.log(`Remaining Demo Users: ${remainingDemoUsers}`);
    console.log(`Remaining Demo Drivers: ${remainingDemoDrivers}`);
    console.log(`Remaining Demo Vehicles: ${remainingDemoVehicles}`);

    // Check newly seeded counts
    const customerCount = await User.countDocuments({
      phone: { $in: ["9001000001", "9001000002", "9001000003", "9001000004", "9001000005"] }
    });
    const driverCount = await User.countDocuments({
      phone: { $in: ["9101000001", "9101000002", "9101000003", "9101000004", "9101000005"] }
    });
    const vehicleCount = await Vehicle.countDocuments({
      vehicleNumber: { $in: ["UP70BT4521", "UP70CT6812", "UP70DT9245", "UP70ET3178", "UP70FT5836"] }
    });

    console.log(`Seeded Customers present: ${customerCount}/5`);
    console.log(`Seeded Drivers present: ${driverCount}/5`);
    console.log(`Seeded Vehicles present: ${vehicleCount}/5`);

    // 2. Customer Login verification
    const custRes = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9001000001", password: "Real@12345" });

    const custLoginPass = custRes.status === 200 && custRes.body.data?.user?.role === "customer";
    console.log(`Customer Login: ${custLoginPass ? "PASS" : "FAIL"} (Status: ${custRes.status})`);

    let custMePass = false;
    if (custRes.body.data?.token) {
      const custMeRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${custRes.body.data.token}`);
      const fetchedRole = custMeRes.body.data?.user?.role || custMeRes.body.data?.role;
      custMePass = custMeRes.status === 200 && fetchedRole === "customer";
      console.log(`Customer /api/auth/me: ${custMePass ? "PASS" : "FAIL"} (Status: ${custMeRes.status})`);
    }

    // 3. Driver Login verification
    const driverRes = await request(app)
      .post("/api/auth/driver/login")
      .send({ phone: "9101000001", password: "Real@12345" });

    const driverLoginPass = driverRes.status === 200 && driverRes.body.data?.user?.role === "driver";
    console.log(`Driver Login: ${driverLoginPass ? "PASS" : "FAIL"} (Status: ${driverRes.status})`);

    let driverMePass = false;
    if (driverRes.body.data?.token) {
      const driverMeRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${driverRes.body.data.token}`);
      const fetchedRole = driverMeRes.body.data?.user?.role || driverMeRes.body.data?.role;
      driverMePass = driverMeRes.status === 200 && fetchedRole === "driver";
      console.log(`Driver /api/auth/me: ${driverMePass ? "PASS" : "FAIL"} (Status: ${driverMeRes.status})`);
    }

    // 4. Public Vehicle API verification
    const vehicleRes = await request(app).get("/api/vehicles");
    const vehicleApiPass = vehicleRes.status === 200;
    console.log(`Public Vehicle API (GET /api/vehicles): ${vehicleApiPass ? "PASS" : "FAIL"} (Status: ${vehicleRes.status})`);

    // 5. Admin API verification
    // Login as Admin to get admin token
    const adminPhone = process.env.SEED_ADMIN_PHONE || "9999999999";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
    const adminRes = await request(app)
      .post("/api/auth/admin/login")
      .send({ phone: adminPhone, password: adminPassword });

    let adminCustomerPass = false;
    let adminDriverPass = false;
    let adminVehiclePass = false;

    if (adminRes.status === 200 && adminRes.body.data?.token) {
      const adminToken = adminRes.body.data.token;

      const adminCustRes = await request(app)
        .get("/api/admin/customers")
        .set("Authorization", `Bearer ${adminToken}`);
      adminCustomerPass = adminCustRes.status === 200 && Array.isArray(adminCustRes.body.data?.customers || adminCustRes.body.data);
      console.log(`Admin Customers API (GET /api/admin/customers): ${adminCustomerPass ? "PASS" : "FAIL"} (Status: ${adminCustRes.status})`);

      const adminDrvRes = await request(app)
        .get("/api/admin/drivers")
        .set("Authorization", `Bearer ${adminToken}`);
      adminDriverPass = adminDrvRes.status === 200 && Array.isArray(adminDrvRes.body.data?.drivers || adminDrvRes.body.data);
      console.log(`Admin Drivers API (GET /api/admin/drivers): ${adminDriverPass ? "PASS" : "FAIL"} (Status: ${adminDrvRes.status})`);

      const adminVehRes = await request(app)
        .get("/api/admin/vehicles")
        .set("Authorization", `Bearer ${adminToken}`);
      adminVehiclePass = adminVehRes.status === 200 && Array.isArray(adminVehRes.body.data?.vehicles || adminVehRes.body.data);
      console.log(`Admin Vehicles API (GET /api/admin/vehicles): ${adminVehiclePass ? "PASS" : "FAIL"} (Status: ${adminVehRes.status})`);
    } else {
      console.log(`Admin Login failed with status: ${adminRes.status}`);
    }

    console.log("=== PHASE 26 VERIFICATION END ===");
  } catch (error) {
    console.error("Verification error:", error.message);
  } finally {
    if (isConnected) {
      await mongoose.disconnect();
    }
  }
};

runVerification().then(() => process.exit(0));
