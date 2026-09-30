import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Booking from "../src/models/Booking.js";
import Fare from "../src/models/Fare.js";
import Notification from "../src/models/Notification.js";
import Rating from "../src/models/Rating.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import {
  adminCreateFare
} from "../src/controllers/fareController.js";
import {
  createBooking
} from "../src/controllers/bookingController.js";
import {
  getNotifications
} from "../src/controllers/notificationController.js";
import {
  getRatingReport
} from "../src/controllers/reportController.js";
import {
  calculateEstimatedFare,
  clearFareCache
} from "../src/services/fareService.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { parsePagination } from "../src/utils/pagination.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const fareConfig = {
  baseFare: 100,
  perKmRate: 10,
  perTonRate: 50,
  minimumFare: 150,
  loadingCharge: 10,
  unloadingCharge: 5
};

const bookingBody = (overrides = {}) => ({
  pickup: { address: "Pickup", latitude: 0, longitude: 0 },
  drop: { address: "Drop", latitude: 0, longitude: 0 },
  goods: "General goods",
  weight: { value: 0, unit: "kg" },
  preferredPickupDate: "2030-01-01",
  preferredPickupTime: "10:00",
  vehicleType: "mini-truck",
  ...overrides
});

const mockQuery = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  }
});

test("fare estimate supports kg, ton, zero values, and minimum fare without non-finite results", async (t) => {
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  const cases = [
    { distanceKm: 10, weightValue: 1000, weightUnit: "kg", expected: 265 },
    { distanceKm: 0, weightValue: 1, weightUnit: "ton", expected: 165 },
    { distanceKm: 0, weightValue: 0, weightUnit: "kg", expected: 150 },
    { distanceKm: 0, weightValue: 0, weightUnit: "ton", expected: 150 }
  ];

  for (const input of cases) {
    clearFareCache();
    const total = await calculateEstimatedFare({
      vehicleType: "mini-truck",
      ...input
    });
    assert.equal(total, input.expected);
    assert.ok(Number.isFinite(total));
  }
});

test("fare estimate rejects negative, blank, malformed, non-finite numbers, and invalid units", async (t) => {
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  const invalidInputs = [
    { distanceKm: -1, weightValue: 0, weightUnit: "kg" },
    { distanceKm: "", weightValue: 0, weightUnit: "kg" },
    { distanceKm: "   ", weightValue: 0, weightUnit: "kg" },
    { distanceKm: NaN, weightValue: 0, weightUnit: "kg" },
    { distanceKm: Infinity, weightValue: 0, weightUnit: "kg" },
    { distanceKm: Number.MAX_VALUE, weightValue: 0, weightUnit: "kg" },
    { distanceKm: 0, weightValue: -1, weightUnit: "kg" },
    { distanceKm: 0, weightValue: "", weightUnit: "kg" },
    { distanceKm: 0, weightValue: "   ", weightUnit: "kg" },
    { distanceKm: 0, weightValue: NaN, weightUnit: "kg" },
    { distanceKm: 0, weightValue: Infinity, weightUnit: "kg" },
    { distanceKm: 0, weightValue: 0, weightUnit: "lb" }
  ];

  for (const input of invalidInputs) {
    clearFareCache();
    await assert.rejects(
      calculateEstimatedFare({ vehicleType: "mini-truck", ...input }),
      (error) => error.status === 400
    );
  }
});

test("pagination accepts positive integers and rejects invalid bounds or formats", () => {
  assert.deepEqual(parsePagination({ page: "1", limit: "10" }), {
    page: 1,
    limit: 10,
    skip: 0
  });

  const invalidQueries = [
    { page: "0" },
    { page: "-1" },
    { limit: "0" },
    { limit: "-1" },
    { page: "not-a-number" },
    { limit: "not-a-number" },
    { page: "1.5" },
    { limit: "1.5" },
    { limit: "101" }
  ];

  for (const query of invalidQueries) {
    assert.throws(() => parsePagination(query), /valid integers/);
  }
});

test("notification listing applies valid pagination and returns 400 for invalid pagination", async (t) => {
  const recipient = new mongoose.Types.ObjectId();
  t.mock.method(Notification, "find", () => mockQuery([]));
  t.mock.method(Notification, "countDocuments", async () => 0);

  const validRes = createResponse();
  await getNotifications(
    { user: { _id: recipient }, query: { page: "1", limit: "10" } },
    validRes
  );
  assert.equal(validRes.statusCode, 200);
  assert.equal(validRes.body.data.page, 1);
  assert.equal(validRes.body.data.pages, 0);

  const invalidRes = createResponse();
  await getNotifications(
    { user: { _id: recipient }, query: { page: "0", limit: "10" } },
    invalidRes
  );
  assert.equal(invalidRes.statusCode, 400);
});

test("rating report applies valid pagination and returns 400 for invalid pagination", async (t) => {
  t.mock.method(Rating, "aggregate", async () => []);
  t.mock.method(Rating, "find", () => mockQuery([]));

  const validRes = createResponse();
  await getRatingReport({ query: { page: "1", limit: "10" } }, validRes);
  assert.equal(validRes.statusCode, 200);

  const invalidRes = createResponse();
  await getRatingReport({ query: { page: "1.5", limit: "10" } }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);
});

test("booking accepts zero weight and rejects invalid numeric inputs", async (t) => {
  const customerId = new mongoose.Types.ObjectId();
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    return this;
  });
  t.mock.method(User, "find", async () => []);
  clearCache("booking.enabled");
  clearFareCache();

  const validRes = createResponse();
  await createBooking(
    { user: { _id: customerId }, body: bookingBody() },
    validRes
  );
  assert.equal(validRes.statusCode, 201);
  assert.equal(validRes.body.data.booking.weight.value, 0);

  const invalidBodies = [
    bookingBody({ weight: { value: -1, unit: "kg" } }),
    bookingBody({ weight: { value: "", unit: "kg" } }),
    bookingBody({ weight: { value: "   ", unit: "kg" } }),
    bookingBody({ weight: { value: NaN, unit: "kg" } }),
    bookingBody({ weight: { value: Infinity, unit: "kg" } }),
    bookingBody({ weight: { value: 0, unit: "lb" } }),
    bookingBody({ pickup: { address: "Pickup", latitude: "", longitude: 0 } }),
    bookingBody({ drop: { address: "Drop", latitude: Infinity, longitude: 0 } })
  ];

  for (const body of invalidBodies) {
    const res = createResponse();
    await createBooking({ user: { _id: customerId }, body }, res);
    assert.equal(res.statusCode, 400);
  }

  clearCache("booking.enabled");
});

test("fare creation rejects malformed, negative, and empty numeric fields", async () => {
  const invalidValues = ["invalid", NaN, Infinity, -1, ""];

  for (const baseFare of invalidValues) {
    const res = createResponse();
    await adminCreateFare(
      {
        body: {
          vehicleType: "mini-truck",
          baseFare,
          perKmRate: 1,
          perTonRate: 1,
          minimumFare: 1,
          loadingCharge: 0,
          unloadingCharge: 0
        }
      },
      res
    );
    assert.equal(res.statusCode, 400);
  }
});
