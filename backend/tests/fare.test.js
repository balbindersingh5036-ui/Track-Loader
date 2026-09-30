import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import Fare from "../src/models/Fare.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import { generateToken } from "../src/utils/generateToken.js";
import { clearCache } from "../src/services/systemSettingService.js";

describe("Fare API", () => {
  let customerToken, driverToken, adminToken;
  let adminId, customerId;

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");
    await Fare.deleteMany({});
    await SystemSetting.deleteMany({});
    await User.deleteMany({});

    await SystemSetting.create({ key: "fare.enabled", value: true, type: "boolean", category: "booking" });

    const customer = await User.create({ name: "Cust", phone: "+911234567891", email: "cust@test.com", role: "customer", password: "password123" });
    const driver = await User.create({ name: "Drv", phone: "+911234567892", email: "drv@test.com", role: "driver", password: "password123" });
    const admin = await User.create({ name: "Adm", phone: "+911234567893", email: "adm@test.com", role: "admin", password: "password123" });

    customerId = customer._id;
    adminId = admin._id;

    customerToken = generateToken({ userId: customer._id, role: customer.role });
    driverToken = generateToken({ userId: driver._id, role: driver.role });
    adminToken = generateToken({ userId: admin._id, role: admin.role });

    await Fare.create({
      vehicleType: "mini-truck",
      baseFare: 100,
      perKmRate: 15,
      perTonRate: 50,
      minimumFare: 150,
      loadingCharge: 10,
      unloadingCharge: 10
    });
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it("1. Public fare list", async () => {
    const res = await request(app).get("/api/fares");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.fares.length, 1);
  });

  it("2. Public active fare filtering", async () => {
    const res = await request(app).get("/api/fares?vehicleType=mini-truck");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.fares[0].vehicleType, "mini-truck");
  });

  it("3. Unknown vehicle type", async () => {
    const res = await request(app).get("/api/fares/unknown");
    assert.strictEqual(res.status, 404);
  });

  it("4. Unauthenticated admin route -> 401", async () => {
    const res = await request(app).post("/api/admin/fares").send({ vehicleType: "pickup" });
    assert.strictEqual(res.status, 401);
  });

  it("5. Customer admin fare access -> 403", async () => {
    const res = await request(app).post("/api/admin/fares").set("Authorization", `Bearer ${customerToken}`).send({ vehicleType: "pickup" });
    assert.strictEqual(res.status, 403);
  });

  it("6. Driver admin fare access -> 403", async () => {
    const res = await request(app).post("/api/admin/fares").set("Authorization", `Bearer ${driverToken}`).send({ vehicleType: "pickup" });
    assert.strictEqual(res.status, 403);
  });

  it("7. Admin create fare", async () => {
    const res = await request(app).post("/api/admin/fares")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        vehicleType: "pickup",
        baseFare: 120,
        perKmRate: 18,
        perTonRate: 60,
        minimumFare: 200,
        loadingCharge: 0,
        unloadingCharge: 0
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.fare.vehicleType, "pickup");
  });

  it("8. Duplicate vehicleType rejected", async () => {
    const res = await request(app).post("/api/admin/fares")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        vehicleType: "pickup",
        baseFare: 120,
        perKmRate: 18,
        perTonRate: 60,
        minimumFare: 200,
        loadingCharge: 0,
        unloadingCharge: 0
      });
    assert.strictEqual(res.status, 409);
  });

  it("9. Invalid vehicleType rejected", async () => {
    const res = await request(app).post("/api/admin/fares")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        vehicleType: "bicycle",
        baseFare: 120,
        perKmRate: 18,
        perTonRate: 60,
        minimumFare: 200,
        loadingCharge: 0,
        unloadingCharge: 0
      });
    assert.strictEqual(res.status, 400);
  });

  it("10. Negative fare rejected", async () => {
    const res = await request(app).post("/api/admin/fares")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        vehicleType: "small-truck",
        baseFare: -10,
        perKmRate: 18,
        perTonRate: 60,
        minimumFare: 200,
        loadingCharge: 0,
        unloadingCharge: 0
      });
    assert.strictEqual(res.status, 400);
  });

  it("11. NaN/Infinity rejected", async () => {
    const res = await request(app).post("/api/admin/fares")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        vehicleType: "small-truck",
        baseFare: "invalid",
        perKmRate: Infinity,
        perTonRate: 60,
        minimumFare: 200,
        loadingCharge: 0,
        unloadingCharge: 0
      });
    assert.strictEqual(res.status, 400);
  });

  it("12. Invalid boolean isActive rejected", async () => {
    let fare = await Fare.findOne({ vehicleType: "pickup" });
    const res = await request(app).patch(`/api/admin/fares/${fare._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: "not-a-boolean" });
    assert.strictEqual(res.status, 400);
  });

  it("13. Admin update fare", async () => {
    let fare = await Fare.findOne({ vehicleType: "pickup" });
    const res = await request(app).put(`/api/admin/fares/${fare._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ baseFare: 150 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.fare.baseFare, 150);
  });

  it("14. Admin toggle fare status", async () => {
    let fare = await Fare.findOne({ vehicleType: "pickup" });
    const res = await request(app).patch(`/api/admin/fares/${fare._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.fare.isActive, false);
  });

  it("20. fare.enabled=false blocks booking/fare flow", async () => {
    await SystemSetting.findOneAndUpdate({ key: "fare.enabled" }, { value: false });
    clearCache("fare.enabled");
    const res = await request(app).get("/api/fares");
    assert.strictEqual(res.status, 403);
    await SystemSetting.findOneAndUpdate({ key: "fare.enabled" }, { value: true });
    clearCache("fare.enabled");
  });

});
