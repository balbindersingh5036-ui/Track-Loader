import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";

import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import Fare from "../src/models/Fare.js";
import SystemSetting from "../src/models/SystemSetting.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { generateToken } from "../src/utils/generateToken.js";

describe("Cash on Delivery (COD) and Online Payment Integration", () => {
  let customerUser, customerToken;
  let driverUser, driverProfile, driverToken;
  let unauthorizedDriverUser, unauthorizedDriverProfile, unauthorizedDriverToken;
  let agencyUser, agencyProfile, agencyToken;
  let superAdminUser, superAdminToken;
  let testVehicle;

  const validPickup = { address: "Mumbai Central", latitude: 18.97, longitude: 72.82 };
  const validDrop = { address: "Bandra West", latitude: 19.05, longitude: 72.83 };

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");
    }

    // Clean up previous test entities
    await User.deleteMany({
      phone: { $in: ["+919999000001", "+919999000002", "+919999000003", "+919999000004", "+919999000005"] }
    });

    // 1. Customer
    customerUser = await User.create({
      name: "COD Customer",
      phone: "+919999000001",
      email: "cod_customer@test.com",
      role: "customer",
      password: "Password123!"
    });
    customerToken = generateToken({ userId: customerUser._id, role: customerUser.role });

    // 2. Assigned Driver
    driverUser = await User.create({
      name: "Assigned Driver",
      phone: "+919999000002",
      email: "assigned_driver@test.com",
      role: "driver",
      password: "Password123!"
    });

    // 4. Agency
    agencyUser = await User.create({
      name: "Agency Owner",
      phone: "+919999000004",
      email: "agency_owner@test.com",
      role: "agency",
      password: "Password123!"
    });
    agencyProfile = await Agency.create({
      owner: agencyUser._id,
      agencyName: "Fast Logistics Agency",
      email: "agency_owner@test.com",
      phone: "+919999000004",
      approvalStatus: "approved",
      status: "approved",
      isActive: true
    });
    agencyToken = generateToken({ userId: agencyUser._id, role: agencyUser.role });

    driverProfile = await Driver.create({
      user: driverUser._id,
      fullName: "Assigned Driver",
      phone: "+919999000002",
      approvalStatus: "approved",
      agency: agencyProfile._id,
      agencyAssociation: { status: "approved" },
      isActive: true,
      isOnline: true,
      documents: {
        idProof: { status: "approved" },
        drivingLicense: { status: "approved" }
      }
    });
    driverToken = generateToken({ userId: driverUser._id, role: driverUser.role });

    // 3. Unauthorized Driver
    unauthorizedDriverUser = await User.create({
      name: "Rogue Driver",
      phone: "+919999000003",
      email: "rogue_driver@test.com",
      role: "driver",
      password: "Password123!"
    });
    unauthorizedDriverProfile = await Driver.create({
      user: unauthorizedDriverUser._id,
      fullName: "Rogue Driver",
      phone: "+919999000003",
      approvalStatus: "approved",
      isActive: true
    });
    unauthorizedDriverToken = generateToken({ userId: unauthorizedDriverUser._id, role: unauthorizedDriverUser.role });

    // 5. Super Admin
    superAdminUser = await User.create({
      name: "Super Admin",
      phone: "+919999000005",
      email: "superadmin_cod@test.com",
      role: "admin",
      password: "Password123!"
    });
    superAdminToken = generateToken({ userId: superAdminUser._id, role: superAdminUser.role });

    // Vehicle
    testVehicle = await Vehicle.create({
      agency: agencyProfile._id,
      driver: driverProfile._id,
      vehicleType: "mini-truck",
      vehicleModel: "Tata Ace",
      vehicleNumber: "MH01AB9999",
      loadCapacity: { value: 1000, unit: "kg" },
      isActive: true,
      isAvailable: true,
      approvalStatus: "approved",
      documents: {
        registration: { status: "approved" },
        insurance: { status: "approved" }
      }
    });

    // Ensure Fare and System settings exist
    await Fare.findOneAndUpdate(
      { vehicleType: "mini-truck" },
      {
        vehicleType: "mini-truck",
        perKmRate: 20,
        perTonRate: 100,
        minimumFare: 300,
        isActive: true
      },
      { upsert: true, new: true }
    );

    await SystemSetting.findOneAndUpdate(
      { key: "booking.enabled" },
      { key: "booking.enabled", value: true, isActive: true },
      { upsert: true }
    );

    await SystemSetting.findOneAndUpdate(
      { key: "booking.instantBookingEnabled" },
      { key: "booking.instantBookingEnabled", value: true, isActive: true },
      { upsert: true }
    );

    await SystemSetting.findOneAndUpdate(
      { key: "payment.enabled" },
      { key: "payment.enabled", value: true, isActive: true },
      { upsert: true }
    );

    clearCache();
  });

  after(async () => {
    if (customerUser) await User.deleteOne({ _id: customerUser._id });
    if (driverUser) await User.deleteOne({ _id: driverUser._id });
    if (unauthorizedDriverUser) await User.deleteOne({ _id: unauthorizedDriverUser._id });
    if (agencyUser) await User.deleteOne({ _id: agencyUser._id });
    if (superAdminUser) await User.deleteOne({ _id: superAdminUser._id });
    if (driverProfile) await Driver.deleteOne({ _id: driverProfile._id });
    if (unauthorizedDriverProfile) await Driver.deleteOne({ _id: unauthorizedDriverProfile._id });
    if (agencyProfile) await Agency.deleteOne({ _id: agencyProfile._id });
    if (testVehicle) await Vehicle.deleteOne({ _id: testVehicle._id });
    await Booking.deleteMany({ customer: customerUser?._id });
    await Payment.deleteMany({ customer: customerUser?._id });
    await mongoose.disconnect();
  });

  it("1. Creates an Instant Booking with COD by default and verifies paymentStatus is pending", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        vehicle: testVehicle._id,
        vehicleType: "mini-truck",
        pickup: validPickup,
        drop: validDrop,
        goods: "Packaged goods",
        weight: { value: 600, unit: "kg" },
        preferredPickupDate: today,
        preferredPickupTime: "12:00",
        bookingMode: "instant",
        paymentMethod: "COD"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const booking = res.body.data.booking || res.body.data;
    assert.equal(booking.paymentMethod, "COD");
    assert.equal(booking.paymentStatus, "pending");
    assert.equal(booking.bookingMode, "instant");
    assert.ok(booking.estimatedFare >= 300, "Calculated fare is at least minimum fare");
  });

  it("2. Creates a Scheduled Booking with COD", async () => {
    const futureDate = "2026-12-01";
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        vehicle: testVehicle._id,
        vehicleType: "mini-truck",
        pickup: validPickup,
        drop: validDrop,
        goods: "Furniture",
        weight: { value: 800, unit: "kg" },
        preferredPickupDate: futureDate,
        preferredPickupTime: "10:00",
        bookingMode: "scheduled",
        paymentMethod: "COD"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    const booking = res.body.data.booking || res.body.data;
    assert.equal(booking.paymentMethod, "COD");
    assert.equal(booking.bookingMode, "scheduled");
    assert.equal(booking.paymentStatus, "pending");
  });

  it("3. Strictly blocks createOrder from establishing Razorpay order on COD booking", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-001",
      customer: customerUser._id,
      driver: driverProfile._id,
      agency: agencyProfile._id,
      vehicle: testVehicle._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Machinery",
      weight: { value: 500, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      distanceKm: 10,
      estimatedFare: 400,
      finalFare: 400,
      bookingStatus: "in-progress",
      assignmentStatus: "accepted",
      paymentMethod: "COD",
      paymentStatus: "pending"
    });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ bookingId: booking._id });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Cash on Delivery \(COD\)/i);
  });

  it("4. Allows switching payment method between COD and ONLINE before completion", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-002",
      customer: customerUser._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Hardware",
      weight: { value: 300, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      estimatedFare: 350,
      bookingStatus: "pending",
      paymentMethod: "COD",
      paymentStatus: "pending"
    });

    // Switch to ONLINE
    const switchRes = await request(app)
      .patch(`/api/payments/${booking._id}/payment-method`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ paymentMethod: "ONLINE" });

    assert.equal(switchRes.status, 200);
    assert.equal(switchRes.body.data.paymentMethod, "ONLINE");

    // Verify persisted
    const updated = await Booking.findById(booking._id);
    assert.equal(updated.paymentMethod, "ONLINE");
    assert.ok(updated.paymentHistory.some((h) => h.action === "method_changed" && h.paymentMethod === "ONLINE"));

    // Switch back to COD
    const switchBackRes = await request(app)
      .patch(`/api/payments/${booking._id}/payment-method`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ paymentMethod: "COD" });

    assert.equal(switchBackRes.status, 200);
    assert.equal(switchBackRes.body.data.paymentMethod, "COD");
  });

  it("5. Rejects unauthorized user attempting cash collection with 403 Forbidden", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-003",
      customer: customerUser._id,
      driver: driverProfile._id, // Assigned to driverProfile
      agency: agencyProfile._id,
      vehicle: testVehicle._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Apparel",
      weight: { value: 400, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      estimatedFare: 500,
      bookingStatus: "in-progress",
      paymentMethod: "COD",
      paymentStatus: "pending"
    });

    // Rogue driver tries to collect cash
    const res = await request(app)
      .post(`/api/payments/${booking._id}/cash-collection`)
      .set("Authorization", `Bearer ${unauthorizedDriverToken}`)
      .send({ notes: "Illegal cash collection" });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /driver assigned to this booking/i);
  });

  it("6. Allows authorized assigned driver to record cash collection and updates status to paid", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-004",
      customer: customerUser._id,
      driver: driverProfile._id,
      agency: agencyProfile._id,
      vehicle: testVehicle._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Stationery",
      weight: { value: 650, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      estimatedFare: 650,
      finalFare: 650,
      bookingStatus: "in-progress",
      paymentMethod: "COD",
      paymentStatus: "pending"
    });

    const res = await request(app)
      .post(`/api/payments/${booking._id}/cash-collection`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ notes: "Cash collected upon safe arrival" });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.paymentStatus, "paid");

    // Check database state
    const refreshed = await Booking.findById(booking._id);
    assert.equal(refreshed.paymentStatus, "paid");
    assert.equal(String(refreshed.cashCollectedBy), String(driverUser._id));
    assert.ok(refreshed.cashCollectedAt instanceof Date);
    assert.equal(refreshed.cashCollectionNotes, "Cash collected upon safe arrival");

    // Check Payment document created
    const payment = await Payment.findOne({ booking: booking._id });
    assert.ok(payment, "Payment record exists");
    assert.equal(payment.method, "cash");
    assert.equal(payment.status, "success");
    assert.equal(payment.amount, 650);
  });

  it("7. Rejects duplicate cash collection on already paid booking with 409 Conflict", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-005",
      customer: customerUser._id,
      driver: driverProfile._id,
      agency: agencyProfile._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Books",
      weight: { value: 300, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      estimatedFare: 400,
      finalFare: 400,
      bookingStatus: "completed",
      paymentMethod: "COD",
      paymentStatus: "paid" // already paid
    });

    const res = await request(app)
      .post(`/api/payments/${booking._id}/cash-collection`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ notes: "Attempting duplicate collection" });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already.*marked as paid/i);
  });

  it("8. Allows Super Admin to confirm cash collection", async () => {
    const booking = await Booking.create({
      bookingId: "LB-COD-006",
      customer: customerUser._id,
      driver: driverProfile._id,
      agency: agencyProfile._id,
      vehicleType: "mini-truck",
      pickup: validPickup,
      drop: validDrop,
      goods: "Textiles",
      weight: { value: 700, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      estimatedFare: 800,
      finalFare: 800,
      bookingStatus: "completed",
      paymentMethod: "COD",
      paymentStatus: "pending"
    });

    const res = await request(app)
      .post(`/api/payments/${booking._id}/cash-collection`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ notes: "Office cash deposit verified by Super Admin" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.paymentStatus, "paid");

    const refreshed = await Booking.findById(booking._id);
    assert.equal(refreshed.paymentStatus, "paid");
    assert.equal(String(refreshed.cashCollectedBy), String(superAdminUser._id));
  });
});
