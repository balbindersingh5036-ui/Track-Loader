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

test("approved independent driver with approved identity and vehicle documents can fetch requests", async (t) => {
  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    approvalStatus: "approved",
    isActive: true,
    agency: null,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  }));
  t.mock.method(Vehicle, "find", async () => [{
    vehicleType: "mini-truck",
    isActive: true,
    isAvailable: true,
    agency: null,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  }]);
  t.mock.method(Booking, "find", () => query([]));
  t.mock.method(Booking, "countDocuments", async () => 0);

  const res = response();
  await getDriverRequests({ user: { _id: userId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.bookings, []);
});

test("booking requests reject drivers with pending or rejected identity documents", async (t) => {
  const driver = {
    _id: driverId,
    approvalStatus: "approved",
    isActive: true,
    agency: null,
    documents: {
      idProof: { status: "pending" },
      drivingLicense: { status: "approved" }
    }
  };
  t.mock.method(Driver, "findOne", async () => driver);

  for (const [field, status] of [
    ["idProof", "pending"],
    ["drivingLicense", "rejected"]
  ]) {
    driver.documents[field].status = status;
    const res = response();
    await getDriverRequests({ user: { _id: userId }, query: { page: "1", limit: "10" } }, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Not active, approved, or identity-verified");
  }
});

test("booking request eligibility also requires approved active driver account", async (t) => {
  const driver = {
    _id: driverId,
    approvalStatus: "approved",
    isActive: true,
    agency: null,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };
  t.mock.method(Driver, "findOne", async () => driver);

  for (const update of [
    { approvalStatus: "pending" },
    { approvalStatus: "suspended" },
    { isActive: false }
  ]) {
    Object.assign(driver, update);
    const res = response();
    await getDriverRequests({ user: { _id: userId }, query: {} }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Not active, approved, or identity-verified");
    driver.approvalStatus = "approved";
    driver.isActive = true;
  }
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
