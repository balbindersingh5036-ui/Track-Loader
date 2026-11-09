import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Fare from "../src/models/Fare.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import SystemSetting from "../src/models/SystemSetting.js";
import { generateToken } from "../src/utils/generateToken.js";
import { clearCache } from "../src/services/systemSettingService.js";
import * as fareService from "../src/services/fareService.js";

describe("Dynamic Vehicle Pricing Management System", () => {
  let superAdminUser, ordinaryAdminUser, customerUser, driverUser, agencyUser;
  let superAdminToken, ordinaryAdminToken, customerToken, driverToken, agencyToken;
  let previousSuperAdminUserId;

  before(async () => {
    previousSuperAdminUserId = process.env.SUPER_ADMIN_USER_ID;

    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");

    await User.deleteMany({
      phone: { $in: ["+919876543210", "+919876543211", "+919876543212", "+919876543213", "+919876543214"] }
    });

    superAdminUser = await User.create({
      name: "Super Admin",
      phone: "+919876543210",
      email: "superadmin@loadbalbin.test",
      role: "admin",
      password: "SuperPassword123"
    });

    ordinaryAdminUser = await User.create({
      name: "Ordinary Admin",
      phone: "+919876543211",
      email: "admin@loadbalbin.test",
      role: "admin",
      password: "AdminPassword123"
    });

    customerUser = await User.create({
      name: "Customer One",
      phone: "+919876543212",
      email: "customer@loadbalbin.test",
      role: "customer",
      password: "CustomerPassword123"
    });

    driverUser = await User.create({
      name: "Driver One",
      phone: "+919876543213",
      email: "driver@loadbalbin.test",
      role: "driver",
      password: "DriverPassword123"
    });

    agencyUser = await User.create({
      name: "Agency Owner",
      phone: "+919876543214",
      email: "agency@loadbalbin.test",
      role: "agency",
      password: "AgencyPassword123"
    });

    // Configure Super Admin identity
    process.env.SUPER_ADMIN_USER_ID = superAdminUser._id.toString();

    superAdminToken = generateToken({ userId: superAdminUser._id, role: "admin" });
    ordinaryAdminToken = generateToken({ userId: ordinaryAdminUser._id, role: "admin" });
    customerToken = generateToken({ userId: customerUser._id, role: "customer" });
    driverToken = generateToken({ userId: driverUser._id, role: "driver" });
    agencyToken = generateToken({ userId: agencyUser._id, role: "agency" });

    await SystemSetting.findOneAndUpdate(
      { key: "fare.enabled" },
      { value: true, type: "boolean", category: "booking" },
      { upsert: true }
    );
    clearCache("fare.enabled");

    // Clean up test fares
    await Fare.deleteMany({ vehicleType: "medium-truck" });

    // Seed test fare with exact formula parameters
    await Fare.create({
      vehicleType: "medium-truck",
      perKmRate: 22,
      perTonRate: 80,
      minimumFare: 350,
      isActive: true,
      updatedBy: superAdminUser._id,
      history: [
        {
          perKmRate: 22,
          perTonRate: 80,
          minimumFare: 350,
          updatedBy: superAdminUser._id,
          updatedAt: new Date()
        }
      ]
    });
    fareService.clearFareCache();
  });

  after(async () => {
    if (previousSuperAdminUserId !== undefined) {
      process.env.SUPER_ADMIN_USER_ID = previousSuperAdminUserId;
    } else {
      delete process.env.SUPER_ADMIN_USER_ID;
    }

    await User.deleteMany({
      phone: { $in: ["+919876543210", "+919876543211", "+919876543212", "+919876543213", "+919876543214"] }
    });
    const { defaultFares } = await import("../seeds/fareSeed.js");
    const mediumDefault = defaultFares.find(f => f.vehicleType === "medium-truck");
    if (mediumDefault) {
      await Fare.findOneAndUpdate({ vehicleType: "medium-truck" }, { $set: mediumDefault }, { upsert: true });
    }
    await Booking.deleteMany({ customer: customerUser?._id });
    await mongoose.connection.close();
  });

  it("1. Dynamic Vehicle Categories are retrieved from Vehicle models", async () => {
    const categories = await fareService.getAvailableVehicleCategories();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.includes("mini-truck"));
    assert.ok(categories.includes("pickup"));
    assert.ok(categories.includes("small-truck"));
    assert.ok(categories.includes("medium-truck"));
    assert.ok(categories.includes("large-truck"));
  });

  it("2. Exact 3-Tier Fare Calculation: 100 KM, 2000 KG (2 tons), ₹22/KM, ₹80/Ton, ₹350 Min -> ₹2360", async () => {
    const breakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 100,
      weightValue: 2000,
      weightUnit: "kg"
    });

    assert.equal(breakdown.category, "medium-truck");
    assert.equal(breakdown.ratePerKm, 22);
    assert.equal(breakdown.ratePerTon, 80);
    assert.equal(breakdown.minimumFare, 350);
    assert.equal(breakdown.distanceKm, 100);
    assert.equal(breakdown.cargoWeightKg, 2000);
    assert.equal(breakdown.weightInTon, 2.0);
    assert.equal(breakdown.distanceCharge, 2200); // 100 * 22
    assert.equal(breakdown.weightCharge, 160);    // 2.0 * 80
    assert.equal(breakdown.calculatedFare, 2360); // 2200 + 160
    assert.equal(breakdown.finalFare, 2360);      // MAX(2360, 350)
  });

  it("3. Minimum Fare threshold triggers when calculated total is lower", async () => {
    // 5 KM, 500 KG -> 5 * 22 = 110 dist charge, 0.5 * 80 = 40 wt charge -> calc = 150 < 350 min
    const breakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 5,
      weightValue: 500,
      weightUnit: "kg"
    });

    assert.equal(breakdown.distanceCharge, 110);
    assert.equal(breakdown.weightCharge, 40);
    assert.equal(breakdown.calculatedFare, 150);
    assert.equal(breakdown.finalFare, 350); // Threshold applied
  });

  it("4. Non-Super Admin roles are strictly blocked (403) from modifying pricing", async () => {
    const targetFare = await Fare.findOne({ vehicleType: "medium-truck" });
    assert.ok(targetFare);

    // Customer -> 403 Admin access required
    const custRes = await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ perKmRate: 25 });
    assert.equal(custRes.status, 403);

    // Driver -> 403 Admin access required
    const drvRes = await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ perKmRate: 25 });
    assert.equal(drvRes.status, 403);

    // Agency Owner -> 403 Admin access required
    const agencyRes = await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${agencyToken}`)
      .send({ perKmRate: 25 });
    assert.equal(agencyRes.status, 403);

    // Ordinary Admin -> 403 Only designated Super Admin may manage pricing
    const ordinaryAdminRes = await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${ordinaryAdminToken}`)
      .send({ perKmRate: 25 });
    assert.equal(ordinaryAdminRes.status, 403);
    assert.match(ordinaryAdminRes.body.message, /Super Admin/i);
  });

  it("5. Unconfigured Super Admin returns 503 failsafe", async () => {
    const targetFare = await Fare.findOne({ vehicleType: "medium-truck" });
    const currentSuperAdmin = process.env.SUPER_ADMIN_USER_ID;
    delete process.env.SUPER_ADMIN_USER_ID;

    try {
      const res = await request(app)
        .put(`/api/admin/fares/${targetFare._id}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ perKmRate: 25 });

      assert.equal(res.status, 503);
      assert.match(res.body.message, /not configured/i);
    } finally {
      process.env.SUPER_ADMIN_USER_ID = currentSuperAdmin;
    }
  });

  it("6. Super Admin can update pricing, and update history & updater are persisted in MongoDB", async () => {
    const targetFare = await Fare.findOne({ vehicleType: "medium-truck" });

    const updateRes = await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        perKmRate: 25.5,
        perTonRate: 90,
        minimumFare: 400
      });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.fare.perKmRate, 25.5);
    assert.equal(updateRes.body.data.fare.perTonRate, 90);
    assert.equal(updateRes.body.data.fare.minimumFare, 400);

    // Verify database document and history tracking
    const updatedDoc = await Fare.findById(targetFare._id);
    assert.equal(updatedDoc.perKmRate, 25.5);
    assert.equal(updatedDoc.perTonRate, 90);
    assert.equal(updatedDoc.minimumFare, 400);
    assert.equal(updatedDoc.updatedBy.toString(), superAdminUser._id.toString());
    assert.ok(updatedDoc.history.length >= 2);

    const latestHistory = updatedDoc.history[updatedDoc.history.length - 1];
    assert.equal(latestHistory.perKmRate, 25.5);
    assert.equal(latestHistory.perTonRate, 90);
    assert.equal(latestHistory.minimumFare, 400);
    assert.equal(latestHistory.updatedBy.toString(), superAdminUser._id.toString());
  });

  it("7. Historical bookings retain immutable pricing snapshot when pricing changes later", async () => {
    // 1. Create a historical booking under old rates (25.5 / 90 / 400)
    const booking = await Booking.create({
      bookingId: `TEST-${Date.now()}`,
      customer: customerUser._id,
      pickup: {
        address: "Pickup A",
        latitude: 28.6139,
        longitude: 77.2090,
        location: { type: "Point", coordinates: [77.2090, 28.6139] }
      },
      drop: {
        address: "Drop B",
        latitude: 28.7000,
        longitude: 77.3000,
        location: { type: "Point", coordinates: [77.3000, 28.7000] }
      },
      goods: "Electronics",
      weight: { value: 1000, unit: "kg" },
      vehicleType: "medium-truck",
      preferredPickupDate: new Date(),
      preferredPickupTime: "10:00 AM",
      estimatedFare: 655,
      pricingSnapshot: {
        category: "medium-truck",
        ratePerKm: 25.5,
        ratePerTon: 90,
        minimumFare: 400,
        distanceKm: 20,
        cargoWeightKg: 1000,
        weightInTon: 1.0,
        distanceCharge: 510,
        weightCharge: 90,
        calculatedFare: 600,
        finalFare: 600,
        calculatedAt: new Date()
      }
    });

    // 2. Super Admin changes pricing to new rates (30 / 120 / 500)
    const targetFare = await Fare.findOne({ vehicleType: "medium-truck" });
    await request(app)
      .put(`/api/admin/fares/${targetFare._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        perKmRate: 30,
        perTonRate: 120,
        minimumFare: 500
      });

    // 3. Verify historical booking in MongoDB has NOT changed
    const historicalBooking = await Booking.findById(booking._id);
    assert.equal(historicalBooking.estimatedFare, 655);
    assert.equal(historicalBooking.pricingSnapshot.ratePerKm, 25.5);
    assert.equal(historicalBooking.pricingSnapshot.ratePerTon, 90);
    assert.equal(historicalBooking.pricingSnapshot.minimumFare, 400);
    assert.equal(historicalBooking.pricingSnapshot.finalFare, 600);

    // 4. Verify new fare calculation for future bookings uses new rates
    const newBreakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 20,
      weightValue: 1000,
      weightUnit: "kg"
    });
    assert.equal(newBreakdown.ratePerKm, 30);
    assert.equal(newBreakdown.ratePerTon, 120);
    assert.equal(newBreakdown.minimumFare, 500);
    assert.equal(newBreakdown.distanceCharge, 600); // 20 * 30
    assert.equal(newBreakdown.weightCharge, 120);   // 1.0 * 120
    assert.equal(newBreakdown.finalFare, 720);      // 600 + 120
  });

  it("8. Dynamic categories endpoint returns all categories with rate and update status", async () => {
    const res = await request(app)
      .get("/api/admin/fares/categories")
      .set("Authorization", `Bearer ${ordinaryAdminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.data.categories));

    const mediumTruckCategory = res.body.data.categories.find(c => c.type === "medium-truck");
    assert.ok(mediumTruckCategory);
    assert.equal(mediumTruckCategory.hasFare, true);
    assert.equal(mediumTruckCategory.perKmRate, 30);
    assert.equal(mediumTruckCategory.perTonRate, 120);
    assert.equal(mediumTruckCategory.minimumFare, 500);
    assert.ok(mediumTruckCategory.updatedAt);
  });
});
