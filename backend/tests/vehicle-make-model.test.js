import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";

import "../src/ipv4.js";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Agency from "../src/models/Agency.js";
import Vehicle from "../src/models/Vehicle.js";
import { generateToken } from "../src/utils/generateToken.js";
import { isValidVehicleModel, formatFullVehicleModel } from "../src/utils/vehicleValidation.js";

describe("Vehicle Make & Model Management", () => {
  let agencyOwnerToken, superAdminToken;
  let testAgency, testVehicle;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");

    // Create Agency Owner User
    await User.deleteMany({ email: { $in: ["agency-model-test@loadbalbin.com", "admin-model-test@loadbalbin.com"] } });
    const agencyUser = await User.create({
      name: "Agency Owner Model Test",
      email: "agency-model-test@loadbalbin.com",
      phone: "+919988776655",
      password: "Password123!",
      role: "agency",
      isActive: true
    });
    agencyOwnerToken = generateToken({ userId: agencyUser._id, role: "agency" });

    // Create Super Admin User
    const adminUser = await User.create({
      name: "Admin Model Test",
      email: "admin-model-test@loadbalbin.com",
      phone: "+919988776656",
      password: "Password123!",
      role: "admin",
      isActive: true
    });
    superAdminToken = generateToken({ userId: adminUser._id, role: "admin" });

    // Create Approved Agency
    testAgency = await Agency.create({
      owner: agencyUser._id,
      agencyName: "Model Test Logistics",
      email: "agency-model-test@loadbalbin.com",
      phone: "9988776655",
      approvalStatus: "approved",
      isActive: true
    });

    // Create Initial Vehicle
    testVehicle = await Vehicle.create({
      agency: testAgency._id,
      vehicleNumber: "TEST99AB1234",
      vehicleMake: "Tata",
      vehicleModel: "Tata Ace Gold",
      vehicleType: "mini-truck",
      loadCapacity: { value: 750, unit: "kg" },
      bodyType: "open",
      isActive: true,
      isAvailable: true
    });
  });

  after(async () => {
    if (testVehicle?._id) await Vehicle.findByIdAndDelete(testVehicle._id);
    if (testAgency?._id) await Agency.findByIdAndDelete(testAgency._id);
    await User.deleteMany({ email: { $in: ["agency-model-test@loadbalbin.com", "admin-model-test@loadbalbin.com"] } });
    await mongoose.connection.close();
  });

  it("1. isValidVehicleModel correctly distinguishes real model names from invalid codes", () => {
    assert.strictEqual(isValidVehicleModel("Tata Ace Gold"), true);
    assert.strictEqual(isValidVehicleModel("Mahindra Jeeto"), true);
    assert.strictEqual(isValidVehicleModel("Eicher Pro 2049"), true);
    assert.strictEqual(isValidVehicleModel("Tata 407 LPT Fleet"), true);
    assert.strictEqual(isValidVehicleModel("Dost+"), true);

    // Reject pure numbers and codes
    assert.strictEqual(isValidVehicleModel("300"), false);
    assert.strictEqual(isValidVehicleModel("400"), false);
    assert.strictEqual(isValidVehicleModel("12345"), false);
    assert.strictEqual(isValidVehicleModel(""), false);
    assert.strictEqual(isValidVehicleModel("  "), false);
    assert.strictEqual(isValidVehicleModel("6ae5b1bc862f760a2e85d654"), false);
    assert.strictEqual(isValidVehicleModel("TEST99AB1234", "TEST99AB1234"), false);
  });

  it("2. formatFullVehicleModel normalizes make and model without duplication", () => {
    assert.strictEqual(formatFullVehicleModel("Tata", "Ace Gold"), "Tata Ace Gold");
    assert.strictEqual(formatFullVehicleModel("Tata", "Tata Ace Gold"), "Tata Ace Gold");
    assert.strictEqual(formatFullVehicleModel("Mahindra", "Jeeto Plus"), "Mahindra Jeeto Plus");
    assert.strictEqual(formatFullVehicleModel("", "Eicher Pro"), "Eicher Pro");
  });

  it("3. Agency vehicle creation rejects numeric model value like '300'", async () => {
    const res = await request(app)
      .post("/api/agency/vehicles")
      .set("Authorization", `Bearer ${agencyOwnerToken}`)
      .send({
        vehicleNumber: "TEST99CD5678",
        vehicleModel: "300",
        vehicleType: "mini-truck",
        loadCapacity: { value: 500, unit: "kg" },
        bodyType: "open"
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("valid vehicle make and model"));
  });

  it("4. Agency vehicle update rejects numeric model value like '300'", async () => {
    const res = await request(app)
      .put(`/api/agency/vehicles/${testVehicle._id}`)
      .set("Authorization", `Bearer ${agencyOwnerToken}`)
      .send({
        vehicleModel: "300"
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("valid vehicle make and model"));
  });

  it("5. Agency owner can update their own vehicle to valid Make & Model", async () => {
    const res = await request(app)
      .put(`/api/agency/vehicles/${testVehicle._id}`)
      .set("Authorization", `Bearer ${agencyOwnerToken}`)
      .send({
        vehicleMake: "Mahindra",
        vehicleModel: "Jeeto Strong"
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.vehicle.vehicleModel, "Mahindra Jeeto Strong");
    assert.strictEqual(res.body.data.vehicle.vehicleMake, "Mahindra");
  });

  it("6. Super Admin can update any vehicle details when authorized", async () => {
    const res = await request(app)
      .put(`/api/admin/vehicles/${testVehicle._id}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        vehicleMake: "Tata",
        vehicleModel: "Tata Ace EV",
        vehicleNumber: "TEST99AB1234"
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.vehicle.vehicleModel, "Tata Ace EV");
  });

  it("7. Public vehicles API returns actual model and proper displayName", async () => {
    const res = await request(app).get("/api/vehicles");
    assert.strictEqual(res.status, 200);
    const vehicle = res.body.data.vehicles.find((v) => v._id === String(testVehicle._id));
    assert.ok(vehicle);
    assert.strictEqual(vehicle.vehicleModel, "Tata Ace EV");
    assert.strictEqual(vehicle.displayName, "Tata Ace EV");
  });
});

