import assert from "node:assert/strict";
import test from "node:test";
import Booking from "../src/models/Booking.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Payment from "../src/models/Payment.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import { adminGetBookingById, adminGetBookings } from "../src/controllers/bookingController.js";

const response = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; }
});

const selectableQuery = (result) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
});

test("admin bookings supports scoped search, filters, sorting, pagination, and global status counts", async (t) => {
  const booking = { _id: "booking-1", bookingId: "LB-100", bookingStatus: "pending" };
  let receivedFilter;
  let receivedSort;
  let receivedSkip;
  let receivedLimit;
  let searchFilters = {};
  const countResults = [12, 12, 2, 1, 1, 2, 2, 3, 1, 2];
  let countIndex = 0;

  t.mock.method(Booking, "find", (filter) => {
    receivedFilter = filter;
    return {
      populate() { return this; },
      sort(value) { receivedSort = value; return this; },
      skip(value) { receivedSkip = value; return this; },
      limit(value) { receivedLimit = value; return this; },
      then(resolve, reject) { return Promise.resolve([booking]).then(resolve, reject); }
    };
  });
  t.mock.method(Booking, "countDocuments", async () => countResults[countIndex++] || 0);
  for (const [model, key, result] of [
    [User, "user", [{ _id: "customer-1" }]],
    [Agency, "agency", [{ _id: "agency-1" }]],
    [Driver, "driver", [{ _id: "driver-1" }]],
    [Vehicle, "vehicle", [{ _id: "vehicle-1" }]]
  ]) {
    t.mock.method(model, "find", (filter) => {
      searchFilters[key] = filter;
      return selectableQuery(result);
    });
  }

  const res = response();
  await adminGetBookings({
    query: {
      page: "3",
      limit: "5",
      search: "LB.*",
      bookingStatus: "pending",
      assignmentStatus: "unassigned",
      bookingMode: "scheduled",
      paymentStatus: "paid",
      vehicleType: "pickup",
      from: "2026-10-01",
      to: "2026-10-31",
      sortBy: "preferredPickupDate",
      sortOrder: "asc"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.bookings[0], booking);
  assert.equal(res.body.data.total, 12);
  assert.equal(res.body.data.page, 3);
  assert.equal(res.body.data.limit, 5);
  assert.deepEqual(res.body.data.stats, {
    total: 12,
    pendingAgencyAssignment: 2,
    awaitingDriverAcceptance: 1,
    driverRejected: 1,
    driverAccepted: 2,
    inProgress: 2,
    completed: 3,
    cancelled: 1
  });
  assert.equal(receivedFilter.bookingStatus, "pending");
  assert.equal(receivedFilter.assignmentStatus, "unassigned");
  assert.equal(receivedFilter.bookingMode, "scheduled");
  assert.equal(receivedFilter.paymentStatus, "paid");
  assert.equal(receivedFilter.vehicleType, "pickup");
  assert.equal(receivedFilter.createdAt.$gte.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(receivedFilter.createdAt.$lt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(receivedFilter.$or[0].bookingId.source, "LB\\.\\*");
  assert.deepEqual(receivedFilter.$or[3], { customer: { $in: ["customer-1"] } });
  assert.ok(searchFilters.user.$or[0].name instanceof RegExp);
  assert.deepEqual(receivedSort, { preferredPickupDate: 1 });
  assert.equal(receivedSkip, 10);
  assert.equal(receivedLimit, 5);
});

test("admin bookings rejects invalid status and reversed date filters", async () => {
  const invalidStatus = response();
  await adminGetBookings({ query: { bookingStatus: "unknown" } }, invalidStatus);
  assert.equal(invalidStatus.statusCode, 400);
  assert.match(invalidStatus.body.message, /booking status/i);

  const reversedDates = response();
  await adminGetBookings({ query: { from: "2026-10-31", to: "2026-10-01" } }, reversedDates);
  assert.equal(reversedDates.statusCode, 400);
  assert.match(reversedDates.body.message, /on or before/i);
});

test("admin booking details populate authorized relations and the recorded payment", async (t) => {
  const booking = {
    _id: "507f1f77bcf86cd799439011",
    assignmentHistory: []
  };
  const payment = { amount: 1250, method: "online", status: "success", transactionId: "TX-100" };
  const populateCalls = [];
  const populateProjections = [];
  let paymentFilter;

  t.mock.method(Booking, "findById", () => ({
    populate(value, projection) { populateCalls.push(value); populateProjections.push(projection); return this; },
    then(resolve, reject) { return Promise.resolve(booking).then(resolve, reject); }
  }));
  t.mock.method(Payment, "findOne", (filter) => {
    paymentFilter = filter;
    return {
      select() { return this; },
      lean() { return Promise.resolve(payment); }
    };
  });

  const res = response();
  await adminGetBookingById({ params: { id: booking._id } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking, booking);
  assert.equal(res.body.data.payment, payment);
  assert.deepEqual(paymentFilter, { booking: booking._id });
  assert.ok(populateCalls.some((path) => typeof path === "object" && path.path === "agency" && path.populate.path === "owner"));
  assert.ok(populateProjections.some((fields) => fields?.includes("documents.idProof.status")));
  assert.ok(populateProjections.some((fields) => fields?.includes("documents.registration.status")));
});
