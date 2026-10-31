import assert from "node:assert/strict";
import test from "node:test";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Notification from "../src/models/Notification.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import SystemSetting from "../src/models/SystemSetting.js";
import adminBookingRoutes from "../src/routes/adminBookingRoutes.js";
import {
  acceptBooking,
  adminGetBookingById,
  cancelBooking,
  getDriverRequests,
  rejectBooking
} from "../src/controllers/bookingController.js";
import { assignAgencyBooking, getAgencyBookings } from "../src/controllers/agencyController.js";
import { clearCache } from "../src/services/systemSettingService.js";

const agencyId = "507f1f77bcf86cd799439011";
const agencyOwnerId = "507f1f77bcf86cd799439012";
const driverId = "507f1f77bcf86cd799439013";
const otherDriverId = "507f1f77bcf86cd799439014";
const driverUserId = "507f1f77bcf86cd799439015";
const otherDriverUserId = "507f1f77bcf86cd799439016";
const bookingId = "507f1f77bcf86cd799439017";
const vehicleId = "507f1f77bcf86cd799439018";

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

const activeAgency = {
  _id: agencyId,
  owner: agencyOwnerId,
  approvalStatus: "approved",
  isActive: true
};
const eligibleDriver = {
  _id: driverId,
  user: driverUserId,
  agency: agencyId,
  agencyAssociation: { status: "approved" },
  approvalStatus: "approved",
  isActive: true,
  documents: {
    idProof: { status: "approved" },
    drivingLicense: { status: "approved" }
  }
};
const eligibleVehicle = {
  _id: vehicleId,
  agency: agencyId,
  driver: driverId,
  vehicleType: "mini-truck",
  loadCapacity: { value: 1000, unit: "kg" },
  isActive: true,
  isAvailable: true,
  documents: {
    registration: { status: "approved" },
    insurance: { status: "approved" }
  }
};
const pendingBooking = () => ({
  _id: bookingId,
  bookingId: "LB-TEST-1",
  agency: agencyId,
  customer: otherDriverUserId,
  bookingStatus: "pending",
  assignmentStatus: "unassigned",
  driver: null,
  vehicle: null,
  vehicleType: "mini-truck",
  weight: { value: 500, unit: "kg" },
  assignmentHistory: []
});

const mockNotifications = (t) => {
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);
};

test("Agency assigns its eligible driver and booking remains pending until driver acceptance", async (t) => {
  mockNotifications(t);
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve({ role: "driver" }); }
  }));
  const booking = pendingBooking();
  const assignedBooking = {
    ...booking,
    agency: agencyId,
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance"
  };
  let bookingUpdate;
  let driverFilter;
  t.mock.method(Agency, "findOne", async () => activeAgency);
  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Driver, "findOne", async (filter) => {
    driverFilter = filter;
    return eligibleDriver;
  });
  t.mock.method(Vehicle, "findOne", async () => eligibleVehicle);
  t.mock.method(Vehicle, "findOneAndUpdate", async () => ({ ...eligibleVehicle, isAvailable: false }));
  t.mock.method(Booking, "findOneAndUpdate", async (_filter, update) => {
    bookingUpdate = update;
    return assignedBooking;
  });

  const res = response();
  await assignAgencyBooking({
    params: { id: bookingId },
    body: { driverId, vehicleId },
    user: { _id: agencyOwnerId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(driverFilter, { _id: driverId, agency: agencyId });
  assert.equal(bookingUpdate.$set.assignmentStatus, "pending_acceptance");
  assert.equal(bookingUpdate.$set.bookingStatus, undefined);
  assert.equal(res.body.data.booking.bookingStatus, "pending");
  assert.equal(res.body.data.booking.driver, driverId);
});

test("Agency assignment cannot select another agency's or an unapproved driver", async (t) => {
  const booking = pendingBooking();
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve({ role: "driver" }); }
  }));
  t.mock.method(Agency, "findOne", async () => activeAgency);
  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Driver, "findOne", async () => null);
  let res = response();
  await assignAgencyBooking({
    params: { id: bookingId },
    body: { driverId: otherDriverId, vehicleId },
    user: { _id: agencyOwnerId }
  }, res);
  assert.equal(res.statusCode, 403);

  t.mock.method(Driver, "findOne", async () => ({
    ...eligibleDriver,
    approvalStatus: "pending"
  }));
  t.mock.method(Vehicle, "findOne", async () => eligibleVehicle);
  t.mock.method(Vehicle, "findOneAndUpdate", async () => {
    assert.fail("Ineligible drivers must not reserve a vehicle");
  });
  res = response();
  await assignAgencyBooking({
    params: { id: bookingId },
    body: { driverId, vehicleId },
    user: { _id: agencyOwnerId }
  }, res);
  assert.equal(res.statusCode, 400);
});

test("Agency assignment remains blocked while personal driver KYC is pending", async (t) => {
  const booking = pendingBooking();
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve({ role: "driver" }); }
  }));
  t.mock.method(Agency, "findOne", async () => activeAgency);
  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Driver, "findOne", async () => ({
    ...eligibleDriver,
    documents: {
      idProof: { status: "pending" },
      drivingLicense: { status: "approved" }
    }
  }));
  t.mock.method(Vehicle, "findOne", async () => eligibleVehicle);
  t.mock.method(Vehicle, "findOneAndUpdate", async () => {
    assert.fail("A driver with pending personal KYC must not reserve a vehicle");
  });

  const res = response();
  await assignAgencyBooking({
    params: { id: bookingId },
    body: { driverId, vehicleId },
    user: { _id: agencyOwnerId }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Aadhaar and Driving Licence/i);
});

test("Agency cannot claim an unowned booking that is not routed to it", async (t) => {
  t.mock.method(Agency, "findOne", async () => activeAgency);
  t.mock.method(Booking, "findById", async () => ({
    ...pendingBooking(),
    agency: null,
    vehicle: null
  }));
  t.mock.method(Driver, "findOne", async () => {
    assert.fail("Unrouted bookings must be rejected before selecting a driver");
  });

  const res = response();
  await assignAgencyBooking({
    params: { id: bookingId },
    body: { driverId, vehicleId },
    user: { _id: agencyOwnerId }
  }, res);

  assert.equal(res.statusCode, 403);
});

test("only the assigned driver can see, accept, or reject an assigned booking", async (t) => {
  mockNotifications(t);
  const assignedBooking = {
    ...pendingBooking(),
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance"
  };
  t.mock.method(Driver, "findOne", async () => ({
    ...eligibleDriver,
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true }
  }));
  t.mock.method(Vehicle, "find", async () => [eligibleVehicle]);
  let observedQuery;
  t.mock.method(Booking, "find", (filter) => {
    observedQuery = filter;
    return query([assignedBooking]);
  });
  t.mock.method(Booking, "countDocuments", async () => 1);
  const requests = response();
  await getDriverRequests({ user: { _id: driverUserId }, query: {} }, requests);
  assert.equal(requests.statusCode, 200);
  assert.equal(observedQuery.driver, driverId);
  assert.equal(observedQuery.assignmentStatus.$in.includes("pending_acceptance"), true);

  t.mock.method(Booking, "findOne", async () => null);
  let res = response();
  await acceptBooking({ params: { id: bookingId }, user: { _id: otherDriverUserId } }, res);
  assert.equal(res.statusCode, 403);
  res = response();
  await rejectBooking({ params: { id: bookingId }, body: {}, user: { _id: otherDriverUserId } }, res);
  assert.equal(res.statusCode, 403);
});

test("driver rejection releases the booking and reserved vehicle for agency reassignment", async (t) => {
  mockNotifications(t);
  const currentBooking = {
    ...pendingBooking(),
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance"
  };
  const releasedBooking = {
    ...currentBooking,
    driver: null,
    vehicle: null,
    assignmentStatus: "rejected",
    assignmentHistory: [{ action: "assigned", vehicle: vehicleId }, { action: "rejected", reason: "Unavailable" }]
  };
  t.mock.method(Driver, "findOne", async () => eligibleDriver);
  t.mock.method(Booking, "findOne", async () => currentBooking);
  t.mock.method(Booking, "findOneAndUpdate", async (_filter, update) => {
    assert.equal(update.$set.bookingStatus, undefined);
    assert.equal(update.$set.assignmentStatus, "rejected");
    return releasedBooking;
  });
  t.mock.method(Agency, "findById", async () => activeAgency);
  let releasedVehicle;
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter, update) => {
    releasedVehicle = { filter, update };
    return {};
  });

  const res = response();
  await rejectBooking({
    params: { id: bookingId },
    body: { reason: "Unavailable" },
    user: { _id: driverUserId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.bookingStatus, "pending");
  assert.equal(res.body.data.booking.assignmentStatus, "rejected");
  assert.equal(releasedVehicle.filter._id, vehicleId);
  assert.equal(releasedVehicle.update.$set.isAvailable, true);
});

test("atomic driver acceptance allows only one concurrent acceptance", async (t) => {
  mockNotifications(t);
  const current = {
    ...pendingBooking(),
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance"
  };
  const accepted = { ...current, bookingStatus: "accepted", assignmentStatus: "accepted" };
  t.mock.method(Driver, "findOne", async () => ({
    ...eligibleDriver,
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true }
  }));
  t.mock.method(Agency, "findById", async () => activeAgency);
  t.mock.method(Booking, "findOne", async () => current);
  t.mock.method(Vehicle, "findOne", async () => ({ ...eligibleVehicle, isAvailable: false }));
  let updates = 0;
  t.mock.method(Booking, "findOneAndUpdate", async (_filter, update) => {
    assert.equal(update.$set.assignmentStatus, "accepted");
    updates += 1;
    return updates === 1 ? accepted : null;
  });

  const first = response();
  const second = response();
  await Promise.all([
    acceptBooking({ params: { id: bookingId }, user: { _id: driverUserId } }, first),
    acceptBooking({ params: { id: bookingId }, user: { _id: driverUserId } }, second)
  ]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  assert.equal(updates, 2);
});

test("Agency booking list is scoped to its agency and its assigned fleet", async (t) => {
  let filter;
  t.mock.method(User, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: driverUserId }]); }
  }));
  t.mock.method(Agency, "findOne", async () => activeAgency);
  t.mock.method(Vehicle, "find", () => ({
    select: async () => [{ _id: vehicleId }]
  }));
  t.mock.method(Driver, "find", () => ({
    select: async () => [{ _id: driverId }]
  }));
  t.mock.method(Booking, "find", (receivedFilter) => {
    filter = receivedFilter;
    return query([]);
  });
  t.mock.method(Booking, "countDocuments", async () => 0);

  const res = response();
  await getAgencyBookings({ user: { _id: agencyOwnerId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter.$or[0], { agency: agencyId });
  assert.deepEqual(filter.$or[1], { vehicle: { $in: [vehicleId] } });
  assert.deepEqual(filter.$or[2], { driver: { $in: [driverId] } });
});

test("Super Admin booking routes expose reads only and details include lifecycle history", async (t) => {
  const routeMethods = adminBookingRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.stack[0].method);
  assert.ok(routeMethods.every((method) => method === "get"));

  let chain;
  const booking = { _id: bookingId, assignmentHistory: [{ action: "assigned" }] };
  t.mock.method(Booking, "findById", () => {
    chain = {
      populate() { return this; },
      then(resolve, reject) { return Promise.resolve(booking).then(resolve, reject); }
    };
    return chain;
  });
  t.mock.method(Payment, "findOne", () => ({
    select() { return this; },
    lean() { return Promise.resolve(null); }
  }));
  const res = response();
  await adminGetBookingById({ params: { id: bookingId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.booking.assignmentHistory, booking.assignmentHistory);
});

test("customer cancellation remains atomic and releases an assigned vehicle", async (t) => {
  mockNotifications(t);
  clearCache("booking.customerCancellationEnabled");
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Agency, "findById", async () => activeAgency);
  const currentBooking = {
    ...pendingBooking(),
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance"
  };
  const cancelledBooking = { ...currentBooking, bookingStatus: "cancelled" };
  let cancellationFilter;
  t.mock.method(Booking, "findOne", async () => currentBooking);
  t.mock.method(Booking, "findOneAndUpdate", async (filter, update) => {
    cancellationFilter = filter;
    assert.equal(update.$set.bookingStatus, "cancelled");
    assert.equal(update.$push.assignmentHistory.action, "cancelled");
    return cancelledBooking;
  });
  t.mock.method(Driver, "findById", async () => ({ user: driverUserId }));
  let released;
  t.mock.method(Vehicle, "findByIdAndUpdate", async (id, update) => {
    released = { id, update };
    return {};
  });

  const res = response();
  await cancelBooking({
    params: { id: bookingId },
    body: { reason: "Customer changed the pickup date" },
    user: { _id: otherDriverUserId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(cancellationFilter.bookingStatus.$in, ["pending", "accepted"]);
  assert.equal(released.id, vehicleId);
  assert.equal(released.update.isAvailable, true);
});
