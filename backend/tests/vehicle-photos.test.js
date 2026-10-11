import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import supertest from "supertest";

import "../src/ipv4.js";
import app from "../src/app.js";
import Vehicle from "../src/models/Vehicle.js";
import { connectDB } from "../src/config/db.js";

test("vehicle photos and API verification", async (t) => {
  await connectDB();
  const request = supertest(app);

  await t.test("all active vehicles have valid HTTPS Cloudinary vehicleImage URLs", async () => {
    const res = await request.get("/api/vehicles");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.vehicles));
    assert.ok(res.body.data.vehicles.length >= 6);

    for (const vehicle of res.body.data.vehicles) {
      assert.ok(
        vehicle.vehicleImage && vehicle.vehicleImage.startsWith("https://"),
        `Vehicle ${vehicle.vehicleNumber} missing valid HTTPS photo`
      );
      assert.ok(
        Array.isArray(vehicle.vehicleImages),
        `Vehicle ${vehicle.vehicleNumber} vehicleImages should be an array`
      );
    }
  });

  await t.test("supported vehicle types and body types are represented", async () => {
    const res = await request.get("/api/vehicles");
    const vehicles = res.body.data.vehicles;

    const types = new Set(vehicles.map((v) => v.vehicleType));
    assert.ok(types.has("mini-truck"));
    assert.ok(types.has("pickup"));
    assert.ok(types.has("small-truck"));
    assert.ok(types.has("medium-truck"));
    assert.ok(types.has("large-truck"));

    const bodyTypes = new Set(vehicles.map((v) => v.bodyType));
    assert.ok(bodyTypes.has("open"));
    assert.ok(bodyTypes.has("closed"));
    assert.ok(bodyTypes.has("container"));
  });

  await t.test("getVehicleById returns vehicle with photo and populated driver", async () => {
    const listRes = await request.get("/api/vehicles");
    const target = listRes.body.data.vehicles[0];

    const detailRes = await request.get(`/api/vehicles/${target._id}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.success, true);
    assert.equal(detailRes.body.data.vehicle._id, target._id);
    assert.ok(detailRes.body.data.vehicle.vehicleImage.startsWith("https://"));
    assert.ok(detailRes.body.data.vehicle.driver?.fullName);
  });

  await t.test("getVehiclesByType filters correctly and returns photos", async () => {
    const res = await request.get("/api/vehicles/type/large-truck");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.vehicles.length >= 1);
    for (const v of res.body.data.vehicles) {
      assert.equal(v.vehicleType, "large-truck");
      assert.ok(v.vehicleImage.startsWith("https://"));
    }
  });

  await t.test("fare retrieval for truck types including BharatBenz and Eicher", async () => {
    // 1. By vehicleType
    const fareRes = await request.get("/api/fares/large-truck");
    assert.equal(fareRes.status, 200);
    assert.equal(fareRes.body.success, true);
    assert.equal(fareRes.body.data.fare.vehicleType, "large-truck");
    assert.equal(fareRes.body.data.fare.baseFare, 800);
    assert.equal(fareRes.body.data.fare.perKmRate, 35);
    assert.equal(fareRes.body.data.fare.perTonRate, 120);

    // 2. By vehicle ID (Eicher Pro)
    const eicher = await Vehicle.findOne({ vehicleModel: /Eicher/i }).lean();
    assert.ok(eicher);
    const eicherFareRes = await request.get(`/api/fares/${eicher._id}`);
    assert.equal(eicherFareRes.status, 200);
    assert.equal(eicherFareRes.body.data.fare.vehicleType, "large-truck");

    // 3. By vehicle ID (BharatBenz Container)
    const bharatBenz = await Vehicle.findOne({ vehicleModel: /BharatBenz/i }).lean();
    assert.ok(bharatBenz);
    const bharatBenzFareRes = await request.get(`/api/fares/${bharatBenz._id}`);
    assert.equal(bharatBenzFareRes.status, 200);
    assert.equal(bharatBenzFareRes.body.data.fare.vehicleType, "large-truck");

    // 4. Missing/unknown vehicle type returns clear error
    const unknownRes = await request.get("/api/fares/unknown-vehicle-type");
    assert.equal(unknownRes.status, 404);
    assert.equal(unknownRes.body.success, false);
    assert.equal(unknownRes.body.message, "Active fare not found for this vehicle");
  });

  await mongoose.disconnect();
});
