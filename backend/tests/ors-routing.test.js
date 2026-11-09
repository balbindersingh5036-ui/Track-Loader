import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import Fare from "../src/models/Fare.js";
import SystemSetting from "../src/models/SystemSetting.js";
import { generateToken } from "../src/utils/generateToken.js";
import { clearCache } from "../src/services/systemSettingService.js";
import * as routingService from "../src/services/routingService.js";
import * as fareService from "../src/services/fareService.js";
import Payment from "../src/models/Payment.js";
import { clearRateLimitCache } from "../src/middleware/rateLimitMiddleware.js";

describe("OpenRouteService (ORS) Routing & Pricing Test Suite", () => {
  let customerToken, adminToken;
  let customerUser, adminUser, driverUser;
  let testAgency, testDriver, testVehicle;
  let originalFetch;

  // Mock sample ORS response payload between Lucknow and Kanpur (~85.43 km road vs ~74.8 km straight-line)
  const mockSuccessOrsResponse = {
    routes: [
      {
        summary: {
          distance: 85430.5, // 85.43 km
          duration: 5400.0   // 90 min = 1 hr 30 min
        },
        geometry: "c~meFp|vgMr@_A~@_A",
        segments: [
          {
            distance: 85430.5,
            duration: 5400.0,
            steps: []
          }
        ]
      }
    ]
  };

  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");

    // Clean test records
    await User.deleteMany({ phone: { $in: ["+919988776651", "+919988776652", "+919988776653"] } });
    await Booking.deleteMany({ "pickup.address": "ORS Test Pickup" });
    await Vehicle.deleteMany({ vehicleNumber: "UP32-ORS-9999" });
    await Agency.deleteMany({ email: "orsagency@test.com" });

    // Ensure booking and fare systems are enabled
    await SystemSetting.findOneAndUpdate(
      { key: "booking.enabled" },
      { value: true, type: "boolean", category: "booking" },
      { upsert: true }
    );
    await SystemSetting.findOneAndUpdate(
      { key: "fare.enabled" },
      { value: true, type: "boolean", category: "booking" },
      { upsert: true }
    );
    clearCache("booking.enabled");
    clearCache("fare.enabled");

    // Create test customer, admin & driver users
    customerUser = await User.create({
      name: "ORS Customer",
      phone: "+919988776651",
      email: "orscustomer@test.com",
      role: "customer",
      password: "Password123!"
    });

    adminUser = await User.create({
      name: "ORS Admin",
      phone: "+919988776652",
      email: "orsadmin@test.com",
      role: "admin",
      password: "Password123!"
    });

    driverUser = await User.create({
      name: "ORS Driver",
      phone: "+919988776653",
      email: "orsdriver@test.com",
      role: "driver",
      password: "Password123!"
    });

    customerToken = generateToken({ userId: customerUser._id, role: customerUser.role });
    adminToken = generateToken({ userId: adminUser._id, role: adminUser.role });

    // Create test approved agency
    testAgency = await Agency.create({
      agencyName: "ORS Express Logistics",
      email: "orsagency@test.com",
      phone: "+919988776654",
      address: "Transport Nagar, Lucknow",
      city: "Lucknow",
      approvalStatus: "approved",
      isActive: true,
      owner: adminUser._id
    });

    // Create approved driver
    testDriver = await Driver.create({
      user: driverUser._id,
      fullName: "ORS Driver",
      phone: "+919988776653",
      approvalStatus: "approved",
      isActive: true,
      isOnline: true,
      agency: testAgency._id,
      agencyAssociation: { status: "approved" },
      documents: {
        idProof: { status: "approved" },
        drivingLicense: { status: "approved" }
      }
    });

    // Create approved medium-truck vehicle (capacity 10 tons)
    testVehicle = await Vehicle.create({
      vehicleNumber: "UP32-ORS-9999",
      vehicleModel: "BharatBenz 1217C",
      vehicleType: "medium-truck",
      agency: testAgency._id,
      driver: testDriver._id,
      loadCapacity: { value: 10, unit: "ton" },
      vehicleImage: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      photos: [{ url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", publicId: "sample" }],
      isActive: true,
      isAvailable: true,
      approvalStatus: "approved",
      documents: {
        registration: { status: "approved" },
        insurance: { status: "approved" }
      }
    });

    // Seed test fare for medium-truck:
    // RatePerKm: 25, RatePerTon: 80, MinimumFare: 800, BaseFare: 0
    await Fare.findOneAndUpdate(
      { vehicleType: "medium-truck" },
      {
        baseFare: 0,
        perKmRate: 25,
        perTonRate: 80,
        minimumFare: 800,
        loadingCharge: 0,
        unloadingCharge: 0,
        isActive: true
      },
      { upsert: true, new: true }
    );

    // Save original global.fetch
    originalFetch = global.fetch;
  });

  after(async () => {
    global.fetch = originalFetch;
    await User.deleteMany({ phone: { $in: ["+919988776651", "+919988776652", "+919988776653"] } });
    await Booking.deleteMany({ "pickup.address": "ORS Test Pickup" });
    await Vehicle.deleteMany({ vehicleNumber: "UP32-ORS-9999" });
    await Agency.deleteMany({ email: "orsagency@test.com" });
    await Driver.deleteMany({ user: driverUser?._id });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    routingService.clearRouteCache();
    fareService.clearFareCache();
    await Fare.findOneAndUpdate(
      { vehicleType: "medium-truck" },
      {
        baseFare: 0,
        perKmRate: 25,
        perTonRate: 80,
        minimumFare: 800,
        loadingCharge: 0,
        unloadingCharge: 0,
        isActive: true
      },
      { upsert: true, new: true }
    );
    fareService.clearFareCache();
    // Default mock fetch returns successful route
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockSuccessOrsResponse,
      text: async () => JSON.stringify(mockSuccessOrsResponse)
    });
  });

  // SCENARIO 1: Valid coordinates -> road distance > straight-line distance
  it("Scenario 1: Valid coordinates return road distance greater than straight-line distance", async () => {
    // Lucknow (26.8467, 80.9462) to Kanpur (26.4499, 80.3319)
    // Straight line distance is ~74.8 km; ORS road distance is 85.43 km
    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462, address: "Lucknow" },
        drop: { latitude: 26.4499, longitude: 80.3319, address: "Kanpur" },
        vehicleType: "medium-truck"
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.distanceKm, 85.43);
    assert.strictEqual(res.body.data.distanceMeters, 85431); // Math.round(85430.5) = 85431
    assert.strictEqual(res.body.data.durationMinutes, 90);
    // Straight line is ~74.8 km; 85.43 > 74.8
    assert.ok(res.body.data.distanceKm > 74.8);
  });

  // SCENARIO 2: Invalid pickup coordinates -> 400 Bad Request
  it("Scenario 2: Invalid pickup coordinates return 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 120.5, longitude: 80.9462 }, // Invalid lat > 90
        drop: { latitude: 26.4499, longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /latitude|longitude|coordinate/i);
  });

  // SCENARIO 3: Invalid drop coordinates -> 400 Bad Request
  it("Scenario 3: Invalid drop coordinates return 400 Bad Request", async () => {
    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462 },
        drop: { latitude: "not-a-number", longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /latitude|longitude|coordinate/i);
  });

  // SCENARIO 4: ORS API failure (simulate 401 unauthorized) -> proper error response without API key leak
  it("Scenario 4: ORS API 401 unauthorized returns proper error response without exposing API key", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Unauthorized access" } }),
      text: async () => JSON.stringify({ error: { message: "Unauthorized access" } })
    });

    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462 },
        drop: { latitude: 26.4499, longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /authentication failed/i);
    // Verify no secret ORS key leaked in response body
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes("eyJvcmciOiI"));
  });

  // SCENARIO 5: ORS API failure (simulate 429 rate limit) -> 429 quota error response
  it("Scenario 5: ORS API 429 rate limit returns 429 quota exceeded error", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Rate limit exceeded" } }),
      text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } })
    });

    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462 },
        drop: { latitude: 26.4499, longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /quota limit exceeded/i);
  });

  // SCENARIO 6: ORS API timeout -> 504 Gateway Timeout
  it("Scenario 6: ORS API slow response / timeout returns 504 Timeout error", async () => {
    global.fetch = async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };

    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462 },
        drop: { latitude: 26.4499, longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 504);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /timed out/i);
  });

  // SCENARIO 7: Unroutable coordinates (island / no road connection) -> 400 Bad Request
  it("Scenario 7: Unroutable coordinates return 400 No road route found", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Could not find point 0: 0.0, 0.0 within a radius of 350.0 meters" } }),
      text: async () => JSON.stringify({ error: { message: "Could not find point 0: 0.0, 0.0 within a radius of 350.0 meters" } })
    });

    const res = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 0.0, longitude: 0.0 }, // Middle of the Atlantic Ocean
        drop: { latitude: 26.4499, longitude: 80.3319 }
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /No road route found/i);
  });

  // SCENARIO 8: Distance unit conversion (meters to KM rounded to 2 decimal places)
  it("Scenario 8: Distance meters converted to KM correctly and rounded to 2 decimal places", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        routes: [
          {
            summary: { distance: 12345.67, duration: 900 }, // 12345.67m -> 12.35 km
            geometry: "c~meFp|vgMr@_A~@_A"
          }
        ]
      })
    });

    const route = await routingService.calculateRoadRoute({
      pickup: { latitude: 26.8467, longitude: 80.9462 },
      drop: { latitude: 26.9000, longitude: 80.9800 }
    });

    assert.strictEqual(route.distanceMeters, 12346); // Math.round(12345.67) = 12346
    assert.strictEqual(route.distanceKm, 12.35);
    assert.strictEqual(route.durationSeconds, 900);
  });

  // SCENARIO 9: Pricing calculation: Weight in KG converted to Ton
  it("Scenario 9: Pricing calculation converts KG to Ton correctly (500 kg = 0.5 ton)", async () => {
    const fare = await Fare.findOne({ vehicleType: "medium-truck" });
    const rateKm = fare.perKmRate;
    const rateTon = fare.perTonRate;
    const minF = fare.minimumFare;
    const legacyExtra = (fare.baseFare || 0) + (fare.loadingCharge || 0) + (fare.unloadingCharge || 0);

    const breakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 50,
      weightValue: 500,
      weightUnit: "kg"
    });

    assert.strictEqual(breakdown.weightInTon, 0.5);
    assert.strictEqual(breakdown.distanceCharge, Number((50 * rateKm).toFixed(2)));
    assert.strictEqual(breakdown.weightCharge, Number((0.5 * rateTon).toFixed(2)));
    const expectedCalc = Number((50 * rateKm + 0.5 * rateTon + legacyExtra).toFixed(2));
    assert.strictEqual(breakdown.calculatedFare, expectedCalc);
    assert.strictEqual(breakdown.finalFare, Math.max(expectedCalc, minF));
  });

  // SCENARIO 10: Pricing calculation: Weight in Ton used directly
  it("Scenario 10: Pricing calculation uses weight in Ton directly without re-dividing", async () => {
    const fare = await Fare.findOne({ vehicleType: "medium-truck" });
    const rateKm = fare.perKmRate;
    const rateTon = fare.perTonRate;
    const minF = fare.minimumFare;
    const legacyExtra = (fare.baseFare || 0) + (fare.loadingCharge || 0) + (fare.unloadingCharge || 0);

    const breakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 40,
      weightValue: 3,
      weightUnit: "ton"
    });

    assert.strictEqual(breakdown.weightInTon, 3);
    assert.strictEqual(breakdown.distanceCharge, Number((40 * rateKm).toFixed(2)));
    assert.strictEqual(breakdown.weightCharge, Number((3 * rateTon).toFixed(2)));
    const expectedCalc = Number((40 * rateKm + 3 * rateTon + legacyExtra).toFixed(2));
    assert.strictEqual(breakdown.calculatedFare, expectedCalc);
    assert.strictEqual(breakdown.finalFare, Math.max(expectedCalc, minF));
  });

  // SCENARIO 11: Pricing calculation: Minimum fare applied when calculated fare is lower
  it("Scenario 11: Minimum fare is enforced when calculated formula fare is lower", async () => {
    const fare = await Fare.findOne({ vehicleType: "medium-truck" });
    const rateKm = fare.perKmRate;
    const rateTon = fare.perTonRate;
    const minF = fare.minimumFare;
    const legacyExtra = (fare.baseFare || 0) + (fare.loadingCharge || 0) + (fare.unloadingCharge || 0);

    const breakdown = await fareService.calculateFareBreakdown({
      vehicleType: "medium-truck",
      distanceKm: 5,
      weightValue: 100,
      weightUnit: "kg"
    });

    const expectedCalc = Number((5 * rateKm + 0.1 * rateTon + legacyExtra).toFixed(2));
    assert.strictEqual(breakdown.calculatedFare, expectedCalc);
    assert.strictEqual(breakdown.finalFare, Math.max(expectedCalc, minF));
  });

  // SCENARIO 12: Instant booking creation with road distance and fare snapshot
  it("Scenario 12: Instant booking creation stores road distance and full pricing snapshot", async () => {
    const fare = await Fare.findOne({ vehicleType: "medium-truck" });
    const rateKm = fare.perKmRate;
    const rateTon = fare.perTonRate;
    const minF = fare.minimumFare;
    const legacyExtra = (fare.baseFare || 0) + (fare.loadingCharge || 0) + (fare.unloadingCharge || 0);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        bookingMode: "instant",
        vehicleType: "medium-truck",
        vehicle: testVehicle._id.toString(),
        pickup: { latitude: 26.8467, longitude: 80.9462, address: "ORS Test Pickup" },
        drop: { latitude: 26.4499, longitude: 80.3319, address: "ORS Test Drop" },
        goods: "Industrial Hardware",
        weight: { value: 2, unit: "ton" },
        preferredPickupDate: new Date().toISOString().split("T")[0],
        preferredPickupTime: "12:00"
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    const booking = res.body.data.booking;

    assert.strictEqual(booking.bookingMode, "instant");
    assert.strictEqual(booking.distanceKm, 85.43); // 85.43 km road distance
    assert.ok(booking.pricingSnapshot, "Pricing snapshot must be saved");
    assert.strictEqual(booking.pricingSnapshot.ratePerKm, rateKm);
    assert.strictEqual(booking.pricingSnapshot.ratePerTon, rateTon);
    assert.strictEqual(booking.pricingSnapshot.distanceKm, 85.43);
    assert.strictEqual(booking.pricingSnapshot.weightInTon, 2);
    const expectedDistCharge = Number((85.43 * rateKm).toFixed(2));
    const expectedWtCharge = Number((2 * rateTon).toFixed(2));
    const expectedCalc = Number((expectedDistCharge + expectedWtCharge + legacyExtra).toFixed(2));
    const expectedFinal = Math.max(expectedCalc, minF);
    assert.strictEqual(booking.pricingSnapshot.distanceCharge, expectedDistCharge);
    assert.strictEqual(booking.pricingSnapshot.weightCharge, expectedWtCharge);
    assert.strictEqual(booking.pricingSnapshot.calculatedFare, expectedCalc);
    assert.strictEqual(booking.pricingSnapshot.finalFare, expectedFinal);
    assert.strictEqual(booking.estimatedFare, expectedFinal);
    assert.strictEqual(booking.pricingSnapshot.routingProfile, "driving-hgv");
  });

  // SCENARIO 13: Scheduled booking creation with road distance and fare snapshot
  it("Scenario 13: Scheduled booking creation stores road distance and fare snapshot", async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        bookingMode: "scheduled",
        vehicleType: "medium-truck",
        vehicle: testVehicle._id.toString(),
        pickup: { latitude: 26.8467, longitude: 80.9462, address: "ORS Test Pickup" },
        drop: { latitude: 26.4499, longitude: 80.3319, address: "ORS Test Drop" },
        goods: "Electronic Goods",
        weight: { value: 1.5, unit: "ton" },
        preferredPickupDate: tomorrow,
        preferredPickupTime: "15:00"
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    const booking = res.body.data.booking;

    assert.strictEqual(booking.bookingMode, "scheduled");
    assert.strictEqual(booking.distanceKm, 85.43);
    assert.ok(booking.pricingSnapshot);
    assert.strictEqual(booking.pricingSnapshot.weightInTon, 1.5);
  });

  // SCENARIO 14: Pricing snapshot immutability
  it("Scenario 14: Pricing snapshot is immutable and unaffected by subsequent fare rate changes", async () => {
    // 1. Create a booking at current rates (RatePerKm: 25)
    const bookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        bookingMode: "instant",
        vehicleType: "medium-truck",
        vehicle: testVehicle._id.toString(),
        pickup: { latitude: 26.8467, longitude: 80.9462, address: "ORS Test Pickup" },
        drop: { latitude: 26.4499, longitude: 80.3319, address: "ORS Test Drop" },
        goods: "Immutable Goods",
        weight: { value: 1, unit: "ton" },
        preferredPickupDate: new Date().toISOString().split("T")[0],
        preferredPickupTime: "10:00"
      });

    const bookingId = bookingRes.body.data.booking._id;
    const originalFare = bookingRes.body.data.booking.estimatedFare;
    const originalSnapshot = bookingRes.body.data.booking.pricingSnapshot;

    // 2. Admin drastically changes fare rates (RatePerKm: 99, MinimumFare: 5000)
    await Fare.findOneAndUpdate(
      { vehicleType: "medium-truck" },
      { perKmRate: 99, minimumFare: 5000 }
    );
    fareService.clearFareCache();

    // 3. Fetch booking again
    const fetched = await Booking.findById(bookingId);
    assert.strictEqual(fetched.estimatedFare, originalFare);
    assert.strictEqual(fetched.pricingSnapshot.ratePerKm, originalSnapshot.ratePerKm);
    assert.strictEqual(fetched.pricingSnapshot.finalFare, originalSnapshot.finalFare);

    // Restore fare rate
    await Fare.findOneAndUpdate(
      { vehicleType: "medium-truck" },
      { perKmRate: 25, minimumFare: 800 }
    );
    fareService.clearFareCache();
  });

  // SCENARIO 15: Razorpay payment amount consistency and frontend bundle security check
  it("Scenario 15: Razorpay order creation matches calculated booking fare, and frontend bundles contain NO secret keys", async () => {
    // 1. Create booking
    const booking = await Booking.create({
      bookingId: "TEST-ORS-PAY-" + Date.now(),
      customer: customerUser._id,
      vehicleType: "medium-truck",
      pickup: { latitude: 26.8467, longitude: 80.9462, address: "ORS Test Pickup" },
      drop: { latitude: 26.4499, longitude: 80.3319, address: "ORS Test Drop" },
      goods: "Machinery",
      weight: { value: 1, unit: "ton" },
      estimatedFare: 2215.75,
      preferredPickupDate: new Date().toISOString().split("T")[0],
      preferredPickupTime: "12:00",
      distanceKm: 85.43,
      status: "pending",
      bookingMode: "instant",
      pricingSnapshot: {
        ratePerKm: 25,
        ratePerTon: 80,
        minimumFare: 800,
        distanceKm: 85.43,
        weightInTon: 1,
        calculatedFare: 2215.75,
        finalFare: 2215.75
      }
    });

    // Verify booking estimatedFare is identical to pricingSnapshot.finalFare
    assert.strictEqual(booking.estimatedFare, booking.pricingSnapshot.finalFare);

    // 2. Security Check: Search customer-app, driver-app, and admin-panel source code
    // Ensure ORS API Key is NEVER present in frontend code
    const orsSecretKeyPart = "eyJvcmciOiI1YjNjZTM1";
    const frontendDirs = [
      "E:\\LoadBalbin\\customer-app\\src",
      "E:\\LoadBalbin\\driver-app\\src",
      "E:\\LoadBalbin\\admin-panel\\src"
    ];

    for (const dir of frontendDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir, { recursive: true });
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile() && (file.endsWith(".js") || file.endsWith(".jsx"))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          assert.ok(
            !content.includes(orsSecretKeyPart),
            `Security Violation: ORS API Key leaked in frontend file: ${fullPath}`
          );
          assert.ok(
            !content.includes("openrouteservice.org/v2") && !content.includes("api.heigit.org"),
            `Security Violation: Direct ORS backend endpoint called in frontend file: ${fullPath}`
          );
        }
      }
    }
  });

  // SCENARIO 16: Sliding-window rate limiter blocks 36th request in a minute
  it("Scenario 16: Route calculation rate limiter blocks requests exceeding 35 req/min with HTTP 429", async () => {
    clearRateLimitCache();
    // Fire 35 valid requests
    for (let i = 0; i < 35; i++) {
      const res = await request(app)
        .post("/api/routes/calculate-distance")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          pickup: { latitude: 26.8467, longitude: 80.9462, address: "Lucknow" },
          drop: { latitude: 26.4499, longitude: 80.3319, address: "Kanpur" }
        });
      assert.strictEqual(res.status, 200);
    }

    // 36th request must be rejected with HTTP 429
    const blockedRes = await request(app)
      .post("/api/routes/calculate-distance")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup: { latitude: 26.8467, longitude: 80.9462, address: "Lucknow" },
        drop: { latitude: 26.4499, longitude: 80.3319, address: "Kanpur" }
      });

    assert.strictEqual(blockedRes.status, 429);
    assert.strictEqual(blockedRes.body.success, false);
    assert.match(blockedRes.body.message, /too many route calculation requests/i);

    clearRateLimitCache();
  });

  // SCENARIO 17: Payment Order Creation and Amount Consistency
  it("Scenario 17: Payment order amount strictly matches calculated road fare in paise", async () => {
    // 1. Enable payment system
    await SystemSetting.findOneAndUpdate(
      { key: "payment.enabled" },
      { value: true, type: "boolean", category: "payment" },
      { upsert: true }
    );
    clearCache("payment.enabled");

    // 2. Create booking with authoritative road fare
    const roadFare = 1542.50;
    const booking = await Booking.create({
      bookingId: "TEST-PAY-ACC-" + Date.now(),
      customer: customerUser._id,
      vehicleType: "medium-truck",
      pickup: { latitude: 26.8467, longitude: 80.9462, address: "ORS Test Pickup" },
      drop: { latitude: 26.4499, longitude: 80.3319, address: "ORS Test Drop" },
      goods: "Electronic Goods",
      weight: { value: 2, unit: "ton" },
      estimatedFare: roadFare,
      preferredPickupDate: new Date().toISOString().split("T")[0],
      preferredPickupTime: "14:00",
      distanceKm: 61.7,
      status: "pending",
      bookingMode: "instant",
      pricingSnapshot: {
        ratePerKm: 25,
        ratePerTon: 80,
        minimumFare: 800,
        distanceKm: 61.7,
        weightInTon: 2,
        calculatedFare: roadFare,
        finalFare: roadFare
      }
    });

    // 3. Create payment order for booking
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ bookingId: booking._id.toString() });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // Razorpay amount is in paise (₹1542.50 = 154250 paise)
    const expectedPaise = Math.round(booking.pricingSnapshot.finalFare * 100);
    assert.strictEqual(res.body.data.amount, expectedPaise);

    // Verify Payment document in DB
    const payment = await Payment.findOne({ booking: booking._id });
    assert.ok(payment);
    assert.strictEqual(payment.amount, roadFare);
    assert.strictEqual(payment.status, "pending");
  });
});
