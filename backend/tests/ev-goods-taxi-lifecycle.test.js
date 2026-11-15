import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Booking from "../src/models/Booking.js";
import Vehicle from "../src/models/Vehicle.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import Notification from "../src/models/Notification.js";
import SystemSetting from "../src/models/SystemSetting.js";
import {
  createBooking,
  updateTripStage
} from "../src/controllers/bookingController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { SERVICE_CATEGORIES } from "../src/utils/vehicleCategories.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});

test("EV_GOODS booking is rejected when service is disabled by admin", async (t) => {
  const customerId = new mongoose.Types.ObjectId();

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.ev_goods.enabled") {
      return { key, value: false };
    }
    return { key, value: true };
  });

  clearCache("service.ev_goods.enabled");
  clearCache("booking.enabled");

  const res = createResponse();
  await createBooking({
    user: { _id: customerId },
    body: {
      pickup: { address: "Sector 10, Noida", latitude: 28.58, longitude: 77.33 },
      drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
      vehicleType: "electric-cargo-loader",
      serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
      goods: "Electronics",
      weight: { value: 50, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      bookingMode: "instant",
      paymentMethod: "COD"
    }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /This service category is currently unavailable/i);
  clearCache("service.ev_goods.enabled");
});

test("GOODS_TAXI booking is rejected when service is disabled by admin", async (t) => {
  const customerId = new mongoose.Types.ObjectId();

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.goods_taxi.enabled") {
      return { key, value: false };
    }
    return { key, value: true };
  });

  clearCache("service.goods_taxi.enabled");
  clearCache("booking.enabled");

  const res = createResponse();
  await createBooking({
    user: { _id: customerId },
    body: {
      pickup: { address: "Indiranagar, Bangalore", latitude: 12.97, longitude: 77.64 },
      drop: { address: "Whitefield, Bangalore", latitude: 12.96, longitude: 77.74 },
      vehicleType: "tata-ace",
      serviceCategory: SERVICE_CATEGORIES.GOODS_TAXI,
      goods: "Home Packages",
      weight: { value: 100, unit: "kg" },
      preferredPickupDate: "2026-12-01",
      preferredPickupTime: "10:00",
      bookingMode: "instant",
      paymentMethod: "COD"
    }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /This service category is currently unavailable/i);
  clearCache("service.goods_taxi.enabled");
});

test("EV_GOODS and GOODS_TAXI lifecycle progression with delivery stages and proof", async (t) => {
  const customerId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const driver = { _id: driverId, user: driverUserId };
  const booking = {
    _id: bookingId,
    bookingNumber: "BOOKING-EV-001",
    customer: customerId,
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    vehicleType: "electric-cargo-loader",
    driver: driverId,
    bookingStatus: "in-progress",
    destinationArrivedAt: new Date(),
    unloadedAt: null,
    deliveryProofUrl: "",
    markModified() {},
    async save() { return this; }
  };

  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Booking, "findOne", async () => booking);
  t.mock.method(Booking, "findOneAndUpdate", async (_query, update) => {
    Object.assign(booking, update.$set || update);
    return booking;
  });
  t.mock.method(Notification, "create", async () => ({}));

  // Stage unloaded with delivery proof URL
  const stageRes = createResponse();
  await updateTripStage({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" },
    body: {
      stage: "unloaded",
      deliveryProofUrl: "https://res.cloudinary.com/demo/image/upload/ev-delivery-proof.jpg"
    }
  }, stageRes);

  assert.equal(stageRes.statusCode, 200);
  assert.ok(booking.unloadedAt);
  assert.equal(booking.deliveryProofUrl, "https://res.cloudinary.com/demo/image/upload/ev-delivery-proof.jpg");
});
