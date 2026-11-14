import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Booking from "../src/models/Booking.js";
import Agency from "../src/models/Agency.js";
import Vehicle from "../src/models/Vehicle.js";
import Driver from "../src/models/Driver.js";
import Fare from "../src/models/Fare.js";
import Notification from "../src/models/Notification.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import {
  createBooking,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  startTrip,
  completeTrip
} from "../src/controllers/bookingController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { clearFareCache } from "../src/services/fareService.js";
import { clearRouteCache } from "../src/services/routingService.js";

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

const mockQuery = (value) => ({
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

const fareConfig = {
  baseFare: 100,
  perKmRate: 10,
  perTonRate: 50,
  minimumFare: 150,
  loadingCharge: 10,
  unloadingCharge: 5
};
const approvedDriverDocuments = {
  idProof: { status: "approved" },
  drivingLicense: { status: "approved" }
};
const approvedVehicleDocuments = {
  registration: { status: "approved" },
  insurance: { status: "approved" }
};

const mockIsolatedRouting = (t) => {
  clearRouteCache();
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      routes: [{ summary: { distance: 10000, duration: 600 }, geometry: "" }]
    })
  }));
};

const mockNoDriverConflicts = (t) =>
  t.mock.method(Booking, "exists", async () => null);

const customerId = new mongoose.Types.ObjectId();
const selectedVehicleId = new mongoose.Types.ObjectId();
const alternativeVehicleId = new mongoose.Types.ObjectId();
const approvedDriverUserId = new mongoose.Types.ObjectId();
const approvedDriverId = new mongoose.Types.ObjectId();

test("Instant booking routes only to the approved Driver assigned to the selected vehicle", async (t) => {
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => ({
    _id: filter._id,
    isAvailable: false
  }));
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  const selectedVehicle = {
    _id: selectedVehicleId,
    vehicleType: "mini-truck",
    isActive: true,
    isAvailable: true,
    loadCapacity: { value: 500, unit: "kg" },
    documents: approvedVehicleDocuments,
    agency: {
      _id: agencyId,
      owner: agencyOwnerId,
      approvalStatus: "approved",
      isActive: true
    },
    driver: {
      _id: approvedDriverId,
      user: { _id: approvedDriverUserId, role: "driver" },
      agency: {
        _id: agencyId,
        approvalStatus: "approved",
        isActive: true
      },
      agencyAssociation: { status: "approved" },
      approvalStatus: "approved",
      isActive: true,
      isOnline: true,
      documents: approvedDriverDocuments
    }
  };
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => selectedVehicle
  }));
  const otherVehicleSearch = t.mock.method(Vehicle, "find", () => {
    throw new Error("A selected-vehicle booking must not search for an alternative vehicle");
  });
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.alternativeAssigned, false);
  assert.equal(res.body.data.booking.vehicle.toString(), selectedVehicleId.toString());
  assert.equal(res.body.data.booking.bookingMode, "instant");
  assert.equal(res.body.data.booking.alternativeVehicleAssigned, false);

  assert.equal(res.body.data.booking.bookingStatus, "pending");
  assert.equal(res.body.data.booking.assignmentStatus, "pending_acceptance");
  assert.equal(res.body.data.booking.driver.toString(), approvedDriverId.toString());
  assert.equal(res.body.data.booking.vehicle.toString(), selectedVehicleId.toString());
  assert.equal(otherVehicleSearch.mock.callCount(), 0);

  const driverNotif = savedNotifications.find(n => n.recipient?.toString() === approvedDriverUserId.toString());
  assert.ok(driverNotif);
  const agencyNotif = savedNotifications.find(n => n.recipient?.toString() === agencyOwnerId.toString());
  assert.equal(agencyNotif, undefined);
  assert.equal(driverNotif.title, "New Booking Request");
});

test("Instant booking with an unavailable selected Driver falls back to the Agency Owner", async (t) => {
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  const selectedVehicle = {
    _id: selectedVehicleId,
    isActive: true,
    isAvailable: true,
    vehicleType: "mini-truck",
    loadCapacity: { value: 500, unit: "kg" },
    documents: approvedVehicleDocuments,
    agency: {
      _id: agencyId,
      owner: agencyOwnerId,
      approvalStatus: "approved",
      isActive: true
    },
    driver: {
      _id: approvedDriverId,
      user: { _id: approvedDriverUserId, role: "driver" },
      agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
      agencyAssociation: { status: "approved" },
      approvalStatus: "approved",
      isActive: true,
      isOnline: false,
      documents: approvedDriverDocuments
    }
  };
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => selectedVehicle
  }));
  const otherVehicleSearch = t.mock.method(Vehicle, "find", () => {
    throw new Error("Unavailable selected Driver must not be replaced by another Driver");
  });
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.booking.assignmentStatus, "unassigned");
  assert.equal(res.body.data.booking.driver, null);
  assert.equal(res.body.data.booking.vehicle, null);
  assert.equal(otherVehicleSearch.mock.callCount(), 0);
  assert.equal(
    savedNotifications.some((n) => n.recipient?.toString() === approvedDriverUserId.toString()),
    false
  );
  assert.ok(savedNotifications.some((n) =>
    n.recipient?.toString() === agencyOwnerId.toString() &&
    n.title === "Booking Needs Assignment"
  ));
});

test("A vehicle without an assigned Driver leaves the booking unassigned", async (t) => {
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      _id: selectedVehicleId,
      isActive: true,
      isAvailable: true,
      vehicleType: "mini-truck",
      loadCapacity: { value: 500, unit: "kg" },
      documents: approvedVehicleDocuments,
      agency: {
        _id: agencyId,
        owner: agencyOwnerId,
        approvalStatus: "approved",
        isActive: true
      },
      driver: null
    })
  }));
  const otherVehicleSearch = t.mock.method(Vehicle, "find", () => {
    throw new Error("A vehicle without a Driver must not be replaced automatically");
  });
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Origin", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Destination", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.booking.assignmentStatus, "unassigned");
  assert.equal(res.body.data.booking.driver, null);
  assert.equal(res.body.data.booking.vehicle, null);
  assert.equal(otherVehicleSearch.mock.callCount(), 0);
  assert.ok(savedNotifications.some((n) =>
    n.recipient?.toString() === agencyOwnerId.toString() &&
    n.title === "Booking Needs Assignment"
  ));
});

test("A selected Driver account whose linked User is not a Driver is not assigned", async (t) => {
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      _id: selectedVehicleId,
      isActive: true,
      isAvailable: true,
      vehicleType: "mini-truck",
      loadCapacity: { value: 500, unit: "kg" },
      documents: approvedVehicleDocuments,
      agency: {
        _id: agencyId,
        owner: agencyOwnerId,
        approvalStatus: "approved",
        isActive: true
      },
      driver: {
        _id: approvedDriverId,
        user: { _id: approvedDriverUserId, role: "agency" },
        agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
        agencyAssociation: { status: "approved" },
        approvalStatus: "approved",
        isActive: true,
        isOnline: true,
        documents: approvedDriverDocuments
      }
    })
  }));
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Origin", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Destination", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.booking.assignmentStatus, "unassigned");
  assert.equal(res.body.data.booking.driver, null);
  assert.equal(
    savedNotifications.some((n) => n.recipient?.toString() === approvedDriverUserId.toString()),
    false
  );
  assert.ok(savedNotifications.some((n) => n.recipient?.toString() === agencyOwnerId.toString()));
});

test("A driver with an active booking is not assigned to a conflicting request", async (t) => {
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async (query) => {
    assert.equal(String(query.driver), String(approvedDriverId));
    return { _id: new mongoose.Types.ObjectId() };
  });
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      _id: selectedVehicleId,
      isActive: true,
      isAvailable: true,
      vehicleType: "mini-truck",
      loadCapacity: { value: 500, unit: "kg" },
      documents: approvedVehicleDocuments,
      agency: {
        _id: agencyId,
        owner: agencyOwnerId,
        approvalStatus: "approved",
        isActive: true
      },
      driver: {
        _id: approvedDriverId,
        user: { _id: approvedDriverUserId, role: "driver" },
        agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
        agencyAssociation: { status: "approved" },
        approvalStatus: "approved",
        isActive: true,
        isOnline: true,
        documents: approvedDriverDocuments
      }
    })
  }));
  const reserveVehicle = t.mock.method(Vehicle, "findOneAndUpdate", async () => {
    throw new Error("A conflicting Driver must not reserve the selected vehicle");
  });
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Origin", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Destination", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.booking.assignmentStatus, "unassigned");
  assert.equal(res.body.data.booking.driver, null);
  assert.equal(reserveVehicle.mock.callCount(), 0);
  assert.ok(savedNotifications.some((n) => n.recipient?.toString() === agencyOwnerId.toString()));
});

test("Two concurrent bookings cannot reserve the same driver and vehicle", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const agencyOwnerId = new mongoose.Types.ObjectId();
  let vehicleAvailable = true;
  const savedBookings = [];

  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    savedBookings.push(this);
    return this;
  });
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => {
    if (!vehicleAvailable || !filter.isAvailable) return null;
    vehicleAvailable = false;
    return { _id: alternativeVehicleId, isAvailable: false };
  });
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: agencyOwnerId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "find", () => mockQuery([{
    _id: alternativeVehicleId,
    agency: { _id: agencyId, owner: agencyOwnerId, approvalStatus: "approved", isActive: true },
    vehicleType: "mini-truck",
    loadCapacity: { value: 500, unit: "kg" },
    isActive: true,
    isAvailable: true,
    documents: approvedVehicleDocuments,
    driver: {
      _id: approvedDriverId,
      user: { _id: approvedDriverUserId, role: "driver" },
      agency: agencyId,
      agencyAssociation: { status: "approved" },
      approvalStatus: "approved",
      isActive: true,
      isOnline: true,
      documents: approvedDriverDocuments
    }
  }]));
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const makeRequest = () => ({
    user: { _id: customerId },
    body: {
      pickup: { address: "Origin", latitude: 28.57, longitude: 77.32 },
      drop: { address: "Destination", latitude: 28.63, longitude: 77.21 },
      goods: "Commercial boxes",
      weight: { value: 100, unit: "kg" },
      preferredPickupDate: "2030-01-01",
      preferredPickupTime: "10:00",
      vehicleType: "mini-truck",
      agencyId: agencyId.toString(),
      bookingMode: "instant"
    }
  });
  const firstResponse = createResponse();
  const secondResponse = createResponse();

  await Promise.all([
    createBooking(makeRequest(), firstResponse),
    createBooking(makeRequest(), secondResponse)
  ]);

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(secondResponse.statusCode, 201);
  assert.equal(savedBookings.filter((booking) => booking.driver).length, 1);
  assert.equal(savedBookings.filter((booking) => booking.assignmentStatus === "unassigned").length, 1);
});

test("Selected vehicle with insufficient capacity is rejected without choosing another vehicle", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  const selectedVehicle = {
    _id: selectedVehicleId,
    isActive: true,
    isAvailable: true,
    vehicleType: "mini-truck",
    loadCapacity: { value: 50, unit: "kg" }
  };
  t.mock.method(Vehicle, "findById", async () => selectedVehicle);
  const otherVehicleSearch = t.mock.method(Vehicle, "find", () => {
    throw new Error("A capacity mismatch must not silently select another vehicle");
  });

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
        goods: "Heavy machinery",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        vehicle: selectedVehicleId.toString(),
        bookingMode: "instant"
      }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /capacity is insufficient/i);
  assert.equal(otherVehicleSearch.mock.callCount(), 0);
});

test("Concurrent driver acceptance protection returns 409 when already accepted", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  t.mock.method(Driver, "findOne", async () => ({
    _id: approvedDriverId,
    user: approvedDriverUserId,
    approvalStatus: "approved",
    isActive: true,
    documents: approvedDriverDocuments
  }));
  mockNoDriverConflicts(t);

  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    driver: approvedDriverId,
    vehicle: alternativeVehicleId,
    vehicleType: "mini-truck",
    weight: { value: 100, unit: "kg" }
  }));
  t.mock.method(Booking, "findOneAndUpdate", async () => null);

  t.mock.method(Vehicle, "findOne", async () => ({
    _id: alternativeVehicleId,
    driver: approvedDriverId,
    vehicleType: "mini-truck",
    loadCapacity: { value: 500, unit: "kg" },
    isAvailable: true,
    isActive: true,
    documents: approvedVehicleDocuments
  }));

  // Atomic findOneAndUpdate fails because another concurrent request already accepted the booking

  const res = createResponse();
  await acceptBooking(
    {
      params: { id: bookingId.toString() },
      user: { _id: approvedDriverUserId }
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /already accepted/i);
});

test("Driver cannot accept a booking while another active booking conflicts", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  t.mock.method(Driver, "findOne", async () => ({
    _id: approvedDriverId,
    user: approvedDriverUserId,
    approvalStatus: "approved",
    isActive: true,
    documents: approvedDriverDocuments
  }));
  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    driver: approvedDriverId,
    vehicle: selectedVehicleId,
    vehicleType: "mini-truck",
    weight: { value: 100, unit: "kg" }
  }));
  t.mock.method(Booking, "exists", async (query) => {
    assert.deepEqual(query._id, { $ne: bookingId });
    return { _id: new mongoose.Types.ObjectId() };
  });
  const findVehicle = t.mock.method(Vehicle, "findOne", async () => {
    throw new Error("Conflicting requests must be rejected before vehicle acceptance");
  });
  const acceptUpdate = t.mock.method(Booking, "findOneAndUpdate", async () => {
    throw new Error("Conflicting requests must not be accepted");
  });

  const res = createResponse();
  await acceptBooking(
    {
      params: { id: bookingId.toString() },
      user: { _id: approvedDriverUserId }
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /another active booking/i);
  assert.equal(findVehicle.mock.callCount(), 0);
  assert.equal(acceptUpdate.mock.callCount(), 0);
});

test("Driver acceptance atomically updates the booking and notifies Customer and Agency Owner", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  const agencyOwner = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const notifications = [];
  t.mock.method(Driver, "findOne", async () => ({
    _id: approvedDriverId,
    user: approvedDriverUserId,
    approvalStatus: "approved",
    isActive: true,
    documents: approvedDriverDocuments
  }));
  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    customer,
    agency: agencyId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    driver: approvedDriverId,
    vehicle: selectedVehicleId,
    vehicleType: "mini-truck",
    weight: { value: 100, unit: "kg" }
  }));
  mockNoDriverConflicts(t);
  t.mock.method(Vehicle, "findOne", async () => ({
    _id: selectedVehicleId,
    driver: approvedDriverId,
    vehicleType: "mini-truck",
    loadCapacity: { value: 500, unit: "kg" },
    isAvailable: false,
    isActive: true,
    documents: approvedVehicleDocuments
  }));
  let atomicFilter;
  t.mock.method(Booking, "findOneAndUpdate", async (filter) => {
    atomicFilter = filter;
    return {
      _id: bookingId,
      bookingId: "BOOKING-TEST",
      customer,
      agency: agencyId,
      driver: approvedDriverId,
      vehicle: selectedVehicleId,
      bookingStatus: "accepted",
      assignmentStatus: "accepted"
    };
  });
  t.mock.method(Agency, "findById", async () => ({ owner: agencyOwner }));
  t.mock.method(Notification.prototype, "save", async function () {
    notifications.push(this);
    return this;
  });

  const res = createResponse();
  await acceptBooking(
    {
      params: { id: bookingId.toString() },
      user: { _id: approvedDriverUserId }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.assignmentStatus, "accepted");
  assert.equal(atomicFilter.driver.toString(), approvedDriverId.toString());
  assert.equal(atomicFilter.bookingStatus, "pending");
  assert.equal(atomicFilter.assignmentStatus.$in.includes("pending_acceptance"), true);
  assert.equal(notifications.filter((n) => n.recipient.toString() === customer.toString()).length, 1);
  assert.equal(notifications.filter((n) => n.recipient.toString() === agencyOwner.toString()).length, 1);
});

test("Driver rejection releases the vehicle and notifies Customer and Agency Owner", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  const agencyOwner = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const notifications = [];
  t.mock.method(Driver, "findOne", async () => ({
    _id: approvedDriverId,
    user: approvedDriverUserId
  }));
  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    customer,
    agency: agencyId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    driver: approvedDriverId,
    vehicle: selectedVehicleId
  }));
  t.mock.method(Booking, "findOneAndUpdate", async () => ({
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    customer,
    agency: agencyId,
    bookingStatus: "pending",
    assignmentStatus: "rejected",
    driver: null,
    vehicle: null
  }));
  const releaseVehicle = t.mock.method(Vehicle, "findOneAndUpdate", async () => ({ isAvailable: true }));
  t.mock.method(Agency, "findById", async () => ({ owner: agencyOwner }));
  t.mock.method(Notification.prototype, "save", async function () {
    notifications.push(this);
    return this;
  });

  const res = createResponse();
  await rejectBooking(
    {
      params: { id: bookingId.toString() },
      user: { _id: approvedDriverUserId },
      body: { reason: "Unable to take this booking" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.assignmentStatus, "rejected");
  assert.equal(releaseVehicle.mock.callCount(), 1);
  assert.equal(notifications.filter((n) => n.recipient.toString() === customer.toString()).length, 1);
  assert.equal(notifications.filter((n) => n.recipient.toString() === agencyOwner.toString()).length, 1);
});

test("Customer cancellation notifies the assigned Driver and Agency Owner", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  const driverUser = new mongoose.Types.ObjectId();
  const agencyOwner = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const notifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    customer,
    agency: agencyId,
    driver: approvedDriverId,
    vehicle: selectedVehicleId,
    bookingStatus: "pending"
  }));
  t.mock.method(Booking, "findOneAndUpdate", async () => ({
    _id: bookingId,
    bookingId: "BOOKING-TEST",
    customer,
    agency: agencyId,
    driver: approvedDriverId,
    vehicle: selectedVehicleId,
    bookingStatus: "cancelled"
  }));
  t.mock.method(Driver, "findById", async () => ({ user: driverUser }));
  t.mock.method(Vehicle, "findByIdAndUpdate", async () => ({ isAvailable: true }));
  t.mock.method(Agency, "findById", async () => ({ owner: agencyOwner }));
  t.mock.method(User, "find", async () => []);
  t.mock.method(Notification.prototype, "save", async function () {
    notifications.push(this);
    return this;
  });

  const res = createResponse();
  await cancelBooking(
    {
      params: { id: bookingId.toString() },
      user: { _id: customer },
      body: { reason: "Customer changed plans" }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.bookingStatus, "cancelled");
  assert.ok(notifications.some((n) => n.recipient.toString() === driverUser.toString()));
  assert.ok(notifications.some((n) => n.recipient.toString() === agencyOwner.toString()));
});

test("Trip start and completion notify the Customer", async (t) => {
  const bookingId = new mongoose.Types.ObjectId();
  const customer = new mongoose.Types.ObjectId();
  const notifications = [];
  t.mock.method(Driver, "findOne", async () => ({
    _id: approvedDriverId,
    user: approvedDriverUserId
  }));
  t.mock.method(Booking, "findOneAndUpdate", async (filter, update) => ({
    _id: bookingId,
    customer,
    driver: approvedDriverId,
    vehicle: selectedVehicleId,
    bookingStatus: update.$set.bookingStatus,
    estimatedFare: 250,
    save: async function () {
      return this;
    }
  }));
  t.mock.method(Driver, "findByIdAndUpdate", async () => ({ totalTrips: 1 }));
  t.mock.method(Vehicle, "findByIdAndUpdate", async () => ({ isAvailable: true }));
  t.mock.method(User, "find", async () => []);
  t.mock.method(Notification.prototype, "save", async function () {
    notifications.push(this);
    return this;
  });

  const startResponse = createResponse();
  await startTrip(
    { params: { id: bookingId.toString() }, user: { _id: approvedDriverUserId } },
    startResponse
  );
  const completeResponse = createResponse();
  await completeTrip(
    { params: { id: bookingId.toString() }, user: { _id: approvedDriverUserId } },
    completeResponse
  );

  assert.equal(startResponse.statusCode, 200);
  assert.equal(completeResponse.statusCode, 200);
  assert.equal(notifications.filter((n) => n.recipient.toString() === customer.toString()).length, 2);
});

test("Scheduled booking rejects past pickup date and time", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2020-01-01",
        preferredPickupTime: "10:00",
        vehicleType: "mini-truck",
        bookingMode: "scheduled"
      }
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /future/i);
});

test("Scheduled booking accepts valid future pickup date and time", async (t) => {
  const savedNotifications = [];
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  mockNoDriverConflicts(t);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);
  const agencyId = new mongoose.Types.ObjectId();
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "find", () => mockQuery([{
    _id: alternativeVehicleId,
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
    vehicleType: "mini-truck",
    loadCapacity: { value: 500, unit: "kg" },
    isActive: true,
    isAvailable: true,
    documents: approvedVehicleDocuments,
    driver: {
      _id: approvedDriverId,
      user: { _id: approvedDriverUserId, role: "driver" },
      agency: agencyId,
      agencyAssociation: { status: "approved" },
      approvalStatus: "approved",
      isActive: true,
      documents: approvedDriverDocuments
    }
  }]));
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => ({
    _id: filter._id,
    isAvailable: false
  }));
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  const res = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
        drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
        goods: "Commercial boxes",
        weight: { value: 100, unit: "kg" },
        preferredPickupDate: "2030-05-15",
        preferredPickupTime: "14:30",
        vehicleType: "mini-truck",
        agencyId: agencyId.toString(),
        bookingMode: "scheduled"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.booking.bookingMode, "scheduled");
  assert.equal(res.body.data.booking.preferredPickupDate.toISOString().startsWith("2030-05-15"), true);
  assert.equal(res.body.data.booking.assignmentStatus, "pending_acceptance");
  assert.ok(savedNotifications.some((notification) =>
    notification.recipient?.toString() === approvedDriverUserId.toString() &&
    notification.title === "New Booking Request"
  ));
});
