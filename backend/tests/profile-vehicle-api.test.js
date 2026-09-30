import assert from "node:assert/strict";
import test from "node:test";

import Booking from "../src/models/Booking.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import {
  getBookingsSummary,
  updateProfile
} from "../src/controllers/userController.js";
import {
  createDriverVehicle,
  getAdminVehicles,
  updateDriverVehicle
} from "../src/controllers/vehicleController.js";

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

test("profile updates reject attempts to change protected fields", async () => {
  const res = createResponse();

  await updateProfile(
    { req: undefined, user: { _id: "customer-id" }, body: { role: "admin" } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test("booking summary only aggregates the authenticated customer's bookings", async (t) => {
  const customerId = "customer-id";
  t.mock.method(Booking, "aggregate", async (pipeline) => {
    assert.equal(pipeline[0].$match.customer, customerId);
    return [
      { _id: "pending", count: 2 },
      { _id: "accepted", count: 1 },
      { _id: "rejected", count: 1 },
      { _id: "in-progress", count: 3 },
      { _id: "completed", count: 4 },
      { _id: "cancelled", count: 5 }
    ];
  });
  const res = createResponse();

  await getBookingsSummary({ user: { _id: customerId } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, {
    totalBookings: 16,
    pendingBookings: 2,
    acceptedBookings: 1,
    inProgressBookings: 3,
    completedBookings: 4,
    cancelledBookings: 5
  });
});

test("driver vehicle creation rejects invalid capacity units", async () => {
  const res = createResponse();

  await createDriverVehicle(
    {
      user: { _id: "driver-user-id" },
      body: {
        vehicleNumber: "ab-123",
        vehicleModel: "Truck",
        vehicleType: "pickup",
        loadCapacity: { value: 100, unit: "pounds" },
        bodyType: "open"
      }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test("driver vehicle update scopes its database query to the driver's own vehicle", async (t) => {
  const driverId = "owned-driver-id";
  t.mock.method(Driver, "findOne", async () => ({ _id: driverId }));
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id, "507f1f77bcf86cd799439011");
    assert.equal(filter.driver, driverId);
    assert.deepEqual(update.$set, { vehicleModel: "Updated truck" });
    return { _id: filter._id, vehicleModel: "Updated truck" };
  });
  const res = createResponse();

  await updateDriverVehicle(
    {
      user: { _id: "driver-user-id" },
      params: { id: "507f1f77bcf86cd799439011" },
      body: { vehicleModel: "Updated truck" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test("admin vehicle pagination rejects invalid limits", async () => {
  const res = createResponse();

  await getAdminVehicles({ query: { page: "1", limit: "101" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});
