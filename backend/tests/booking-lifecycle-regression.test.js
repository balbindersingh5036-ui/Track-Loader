import assert from "node:assert/strict";
import test from "node:test";
import Booking from "../src/models/Booking.js";
import Driver from "../src/models/Driver.js";
import Notification from "../src/models/Notification.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import { completeTrip, getDriverRequests } from "../src/controllers/bookingController.js";

const driverId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const bookingId = "507f1f77bcf86cd799439013";
const vehicleId = "507f1f77bcf86cd799439014";

const response = () => ({
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

const query = (value) => ({
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("approved driver with approvalStatus can fetch eligible booking requests", async (t) => {
  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "find", async () => [{ vehicleType: "mini-truck" }]);
  t.mock.method(Booking, "find", () => query([]));
  t.mock.method(Booking, "countDocuments", async () => 0);

  const res = response();
  await getDriverRequests({ user: { _id: userId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.bookings, []);
});

test("trip completion copies estimated fare without an invalid update expression", async (t) => {
  let update;
  let savedFare;
  const booking = {
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    bookingStatus: "completed",
    customer: userId,
    driver: driverId,
    vehicle: vehicleId,
    estimatedFare: 125,
    finalFare: 0,
    async save() {
      savedFare = this.finalFare;
      return this;
    }
  };

  t.mock.method(Driver, "findOne", async () => ({ _id: driverId }));
  t.mock.method(Booking, "findOneAndUpdate", async (_filter, receivedUpdate) => {
    update = receivedUpdate;
    return booking;
  });
  t.mock.method(Driver, "findByIdAndUpdate", async () => ({}));
  t.mock.method(Vehicle, "findByIdAndUpdate", async () => ({}));
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);

  const res = response();
  await completeTrip({ params: { id: bookingId }, user: { _id: userId } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.finalFare, 125);
  assert.equal(savedFare, 125);
  assert.equal(update.$set.finalFare, undefined);
});
