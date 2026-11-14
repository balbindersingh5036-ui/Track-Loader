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
  getDriverRequests,
  acceptBooking,
  rejectBooking
} from "../src/controllers/bookingController.js";
import { getDriverRequests as driverControllerGetRequests } from "../src/controllers/driverController.js";
import { getAgencyBookings } from "../src/controllers/agencyController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { clearFareCache } from "../src/services/fareService.js";
import { clearRouteCache } from "../src/services/routingService.js";
import { matchesBookingFilter, getBookingFilterCounts } from "../../driver-app/src/utils/agencyBookings.mjs";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
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
  baseFare: 120,
  perKmRate: 12,
  perTonRate: 60,
  minimumFare: 180,
  loadingCharge: 15,
  unloadingCharge: 10
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
      routes: [{ summary: { distance: 15000, duration: 900 }, geometry: "mock_geometry" }]
    })
  }));
};

const agencyId = new mongoose.Types.ObjectId();
const agencyOwnerId = new mongoose.Types.ObjectId();
const driverId = new mongoose.Types.ObjectId();
const driverUserId = new mongoose.Types.ObjectId();
const otherDriverId = new mongoose.Types.ObjectId();
const otherDriverUserId = new mongoose.Types.ObjectId();
const vehicleId = new mongoose.Types.ObjectId();
const customerId = new mongoose.Types.ObjectId();

const eligibleDriver = {
  _id: driverId,
  user: { _id: driverUserId, role: "driver" },
  fullName: "Ramesh Kumar",
  phone: "9876543210",
  agency: {
    _id: agencyId,
    owner: agencyOwnerId,
    approvalStatus: "approved",
    isActive: true
  },
  agencyAssociation: { status: "approved" },
  approvalStatus: "approved",
  isActive: true,
  isOnline: true,
  documents: approvedDriverDocuments
};

const eligibleVehicle = {
  _id: vehicleId,
  vehicleNumber: "MH04AB1234",
  vehicleModel: "Mahindra Jeeto",
  vehicleMake: "Mahindra",
  vehicleType: "mini-truck",
  loadCapacity: { value: 600, unit: "kg" },
  isActive: true,
  isAvailable: true,
  documents: approvedVehicleDocuments,
  agency: {
    _id: agencyId,
    owner: agencyOwnerId,
    approvalStatus: "approved",
    isActive: true
  },
  driver: eligibleDriver
};

test("1. Selected vehicle's eligible Driver receives the booking in the Driver App API", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async () => null);
  let createdBooking = null;
  t.mock.method(Booking.prototype, "save", async function () {
    createdBooking = this;
    return this;
  });
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => ({
    _id: filter._id,
    isAvailable: false
  }));
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({ ...eligibleVehicle })
  }));
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  // Customer creates instant booking with selected Mahindra Jeeto
  const resCreate = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Andheri East, Mumbai", latitude: 19.1136, longitude: 72.8697 },
        drop: { address: "Bandra Kurla Complex, Mumbai", latitude: 19.0657, longitude: 72.8687 },
        goods: "Packaged FMCG cartons",
        weight: { value: 300, unit: "kg" },
        preferredPickupDate: "2030-02-01",
        preferredPickupTime: "11:00",
        vehicleType: "mini-truck",
        vehicle: vehicleId.toString(),
        bookingMode: "instant"
      }
    },
    resCreate
  );

  assert.equal(resCreate.statusCode, 201);
  assert.equal(resCreate.body.success, true);
  const booking = resCreate.body.data.booking;
  assert.equal(booking.assignmentStatus, "pending_acceptance");
  assert.equal(booking.bookingStatus, "pending");
  assert.equal(String(booking.driver), String(driverId));
  assert.equal(String(booking.vehicle), String(vehicleId));
  assert.equal(booking.vehicleModel, "Mahindra Jeeto");

  // Driver App fetches requests for this driver
  t.mock.method(Driver, "findOne", async () => eligibleDriver);
  t.mock.method(Vehicle, "find", async () => [eligibleVehicle]);
  t.mock.method(Booking, "find", () => mockQuery([createdBooking]));
  t.mock.method(Booking, "countDocuments", async () => 1);

  const resRequests = createResponse();
  await getDriverRequests({ user: { _id: driverUserId }, query: {} }, resRequests);

  assert.equal(resRequests.statusCode, 200);
  assert.equal(resRequests.body.success, true);
  assert.equal(resRequests.body.data.bookings.length, 1);
  assert.equal(resRequests.body.data.bookings[0].bookingId, createdBooking.bookingId);
  assert.equal(resRequests.body.data.bookings[0].assignmentStatus, "pending_acceptance");
});

test("2. Booking is returned by the Driver booking-request endpoint with all necessary fields", async (t) => {
  const pendingRequest = {
    _id: new mongoose.Types.ObjectId(),
    bookingId: "BOOKING-0025",
    customer: { _id: customerId, name: "Anita Sharma", phone: "9820012345" },
    agency: agencyId,
    driver: driverId,
    vehicle: {
      _id: vehicleId,
      vehicleNumber: "MH04AB1234",
      vehicleModel: "Mahindra Jeeto",
      vehicleType: "mini-truck",
      loadCapacity: { value: 600, unit: "kg" }
    },
    vehicleModel: "Mahindra Jeeto",
    vehicleName: "Mahindra Jeeto",
    pickup: { address: "Vikhroli Industrial Estate", latitude: 19.105, longitude: 72.932 },
    drop: { address: "Powai Commercial Hub", latitude: 19.120, longitude: 72.905 },
    goods: "Textile rolls",
    weight: { value: 350, unit: "kg" },
    distanceKm: 8.5,
    estimatedFare: 450,
    finalFare: 450,
    bookingMode: "instant",
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    paymentMethod: "COD",
    paymentStatus: "pending"
  };

  t.mock.method(Driver, "findOne", async () => eligibleDriver);
  t.mock.method(Vehicle, "find", async () => [eligibleVehicle]);
  t.mock.method(Booking, "find", () => mockQuery([pendingRequest]));
  t.mock.method(Booking, "countDocuments", async () => 1);

  // Test both bookingController and driverController exports
  const res = createResponse();
  await driverControllerGetRequests({ user: { _id: driverUserId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.bookings.length, 1);

  const returned = res.body.data.bookings[0];
  assert.equal(returned.bookingId, "BOOKING-0025");
  assert.equal(returned.pickup.address, "Vikhroli Industrial Estate");
  assert.equal(returned.drop.address, "Powai Commercial Hub");
  assert.equal(returned.goods, "Textile rolls");
  assert.equal(returned.weight.value, 350);
  assert.equal(returned.weight.unit, "kg");
  assert.equal(returned.finalFare, 450);
  assert.equal(returned.bookingMode, "instant");
  assert.equal(returned.bookingStatus, "pending");
  assert.equal(returned.assignmentStatus, "pending_acceptance");
});

test("3. Another Driver cannot see that request", async (t) => {
  const otherDriver = {
    _id: otherDriverId,
    user: { _id: otherDriverUserId, role: "driver" },
    fullName: "Suresh Patil",
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
    agencyAssociation: { status: "approved" },
    approvalStatus: "approved",
    isActive: true,
    isOnline: true,
    documents: approvedDriverDocuments
  };
  const otherVehicle = {
    _id: new mongoose.Types.ObjectId(),
    vehicleNumber: "MH04CD5678",
    vehicleType: "mini-truck",
    isActive: true,
    documents: approvedVehicleDocuments,
    driver: otherDriverId,
    agency: agencyId
  };

  let capturedQuery = null;
  t.mock.method(Driver, "findOne", async (filter) => {
    if (String(filter.user) === String(otherDriverUserId)) return otherDriver;
    return eligibleDriver;
  });
  t.mock.method(Vehicle, "find", async () => [otherVehicle]);
  t.mock.method(Booking, "find", (query) => {
    capturedQuery = query;
    // Driver B's driver._id filter does not match Driver A's booking
    return mockQuery([]);
  });
  t.mock.method(Booking, "countDocuments", async () => 0);

  const res = createResponse();
  await getDriverRequests({ user: { _id: otherDriverUserId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedQuery.driver.toString(), otherDriverId.toString());
  assert.deepEqual(res.body.data.bookings, []);
});

test("4. Unassigned booking is visible to the Agency Owner, not incorrectly assigned to a Driver", async (t) => {
  const offlineDriverVehicle = {
    ...eligibleVehicle,
    driver: {
      ...eligibleDriver,
      isOnline: false // Offline driver
    }
  };

  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async () => null);
  let savedUnassignedBooking = null;
  t.mock.method(Booking.prototype, "save", async function () {
    savedUnassignedBooking = this;
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => offlineDriverVehicle
  }));
  mockIsolatedRouting(t);

  clearCache("booking.enabled");
  clearFareCache();

  // Instant booking where driver is offline
  const resCreate = createResponse();
  await createBooking(
    {
      user: { _id: customerId },
      body: {
        pickup: { address: "Goregaon, Mumbai", latitude: 19.1663, longitude: 72.8526 },
        drop: { address: "Malad, Mumbai", latitude: 19.1874, longitude: 72.8484 },
        goods: "Paper goods",
        weight: { value: 150, unit: "kg" },
        preferredPickupDate: "2030-02-01",
        preferredPickupTime: "12:00",
        vehicleType: "mini-truck",
        vehicle: vehicleId.toString(),
        bookingMode: "instant"
      }
    },
    resCreate
  );

  assert.equal(resCreate.statusCode, 201);
  assert.equal(resCreate.body.data.booking.assignmentStatus, "unassigned");
  assert.equal(resCreate.body.data.booking.driver, null);
  assert.equal(resCreate.body.data.booking.vehicleModel, "Mahindra Jeeto");
  assert.equal(String(resCreate.body.data.booking.agency), String(agencyId));

  // Agency Owner views agency bookings
  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, owner: agencyOwnerId }));
  t.mock.method(Vehicle, "find", () => ({ select: async () => [{ _id: vehicleId }] }));
  t.mock.method(Driver, "find", () => ({ select: async () => [{ _id: driverId }] }));
  t.mock.method(User, "find", () => ({ select: () => ({ lean: async () => [{ _id: driverUserId }] }) }));
  t.mock.method(Booking, "find", () => mockQuery([savedUnassignedBooking]));
  t.mock.method(Booking, "countDocuments", async () => 1);

  const resAgency = createResponse();
  await getAgencyBookings({ user: { _id: agencyOwnerId, role: "agency" }, query: {} }, resAgency);

  assert.equal(resAgency.statusCode, 200);
  assert.equal(resAgency.body.data.bookings.length, 1);
  assert.equal(resAgency.body.data.bookings[0].assignmentStatus, "unassigned");
  assert.equal(resAgency.body.data.bookings[0].driver, null);
});

test("5. Accepted/rejected requests disappear or update according to existing workflow", async (t) => {
  const currentBooking = {
    _id: new mongoose.Types.ObjectId(),
    bookingId: "BOOKING-0025",
    driver: driverId,
    vehicle: vehicleId,
    vehicleType: "mini-truck",
    weight: { value: 200, unit: "kg" },
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    assignmentHistory: []
  };

  t.mock.method(Driver, "findOne", async () => eligibleDriver);
  t.mock.method(Booking, "findOne", async () => currentBooking);
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(Vehicle, "findOne", async () => ({
    _id: vehicleId,
    driver: driverId,
    agency: agencyId,
    vehicleType: "mini-truck",
    loadCapacity: { value: 600, unit: "kg" },
    isActive: true,
    isAvailable: false,
    documents: approvedVehicleDocuments
  }));
  t.mock.method(Booking, "findOneAndUpdate", async (filter, update) => ({
    ...currentBooking,
    ...update.$set
  }));
  t.mock.method(Vehicle, "findOneAndUpdate", async () => ({}));
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);
  t.mock.method(Agency, "findById", async () => ({ _id: agencyId, owner: agencyOwnerId }));

  // 1. Driver accepts booking -> updates assignmentStatus & bookingStatus to "accepted"
  const resAccept = createResponse();
  await acceptBooking({ user: { _id: driverUserId }, params: { id: currentBooking._id.toString() } }, resAccept);

  assert.equal(resAccept.statusCode, 200);
  assert.equal(resAccept.body.data.booking.bookingStatus, "accepted");
  assert.equal(resAccept.body.data.booking.assignmentStatus, "accepted");

  // In getDriverRequests, the query checks bookingStatus: "pending" and assignmentStatus: "pending_acceptance"
  // Accepted booking will not be returned by getDriverRequests
  t.mock.method(Booking, "find", (query) => {
    assert.equal(query.assignmentStatus.$in.includes("accepted"), false);
    return mockQuery([]);
  });
  t.mock.method(Booking, "countDocuments", async () => 0);
  t.mock.method(Vehicle, "find", async () => [eligibleVehicle]);

  const resAfterAccept = createResponse();
  await getDriverRequests({ user: { _id: driverUserId }, query: {} }, resAfterAccept);
  assert.equal(resAfterAccept.statusCode, 200);
  assert.deepEqual(resAfterAccept.body.data.bookings, []);

  // 2. When rejected, status updates to rejected, driver is cleared
  t.mock.method(Booking, "findOne", async () => ({
    ...currentBooking,
    assignmentStatus: "pending_acceptance"
  }));
  t.mock.method(Booking, "findOneAndUpdate", async (_filter, update) => ({
    ...currentBooking,
    driver: null,
    vehicle: null,
    assignmentStatus: update.$set.assignmentStatus,
    rejectedReason: update.$set.rejectedReason
  }));

  const resReject = createResponse();
  await rejectBooking(
    {
      user: { _id: driverUserId },
      params: { id: currentBooking._id.toString() },
      body: { reason: "Vehicle undergoing maintenance" }
    },
    resReject
  );

  assert.equal(resReject.statusCode, 200);
  assert.equal(resReject.body.data.booking.assignmentStatus, "rejected");
  assert.equal(resReject.body.data.booking.driver, null);
});

test("6. Initial fetch and refresh both display pending requests", async (t) => {
  const pendingBooking = {
    _id: new mongoose.Types.ObjectId(),
    bookingId: "BOOKING-0025",
    driver: driverId,
    vehicle: {
      _id: vehicleId,
      vehicleNumber: "MH04AB1234",
      vehicleModel: "Mahindra Jeeto"
    },
    customer: { _id: customerId, name: "Anita Sharma", phone: "9820012345" },
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    goods: "Industrial tools",
    weight: { value: 200, unit: "kg" },
    estimatedFare: 300,
    finalFare: 300,
    bookingMode: "instant"
  };

  t.mock.method(Driver, "findOne", async () => eligibleDriver);
  t.mock.method(Vehicle, "find", async () => [eligibleVehicle]);
  t.mock.method(Booking, "find", () => mockQuery([pendingBooking]));
  t.mock.method(Booking, "countDocuments", async () => 1);

  // Initial fetch
  const resInitial = createResponse();
  await getDriverRequests({ user: { _id: driverUserId }, query: {} }, resInitial);

  assert.equal(resInitial.statusCode, 200);
  assert.equal(resInitial.body.data.bookings.length, 1);
  assert.equal(resInitial.body.data.bookings[0].bookingId, "BOOKING-0025");

  // Refresh (simulated pull-to-refresh or socket event trigger)
  const resRefresh = createResponse();
  await getDriverRequests({ user: { _id: driverUserId }, query: {} }, resRefresh);

  assert.equal(resRefresh.statusCode, 200);
  assert.equal(resRefresh.body.data.bookings.length, 1);
  assert.equal(resRefresh.body.data.bookings[0].bookingId, "BOOKING-0025");
  assert.equal(resRefresh.body.data.bookings[0].assignmentStatus, "pending_acceptance");
});

test("7. Automatic Driver Assignment: Registered vehicle with assigned driver links driver and awaits acceptance", async (t) => {
  clearCache("booking.enabled");
  clearFareCache();
  mockIsolatedRouting(t);

  let savedBooking = null;
  t.mock.method(Booking.prototype, "save", async function save() {
    savedBooking = this;
    return this;
  });
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(User, "find", async () => []);
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      ...eligibleVehicle,
      driver: {
        ...eligibleDriver,
        user: { _id: driverUserId, role: "driver" }
      }
    })
  }));
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => ({
    _id: filter._id,
    isAvailable: false
  }));
  t.mock.method(Driver, "findById", () => ({
    populate: async () => ({
      ...eligibleDriver,
      user: { _id: driverUserId, role: "driver" }
    })
  }));
  t.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ role: "driver" }) })
  }));
  t.mock.method(Notification.prototype, "save", async function save() { return this; });

  const req = {
    user: { _id: customerId },
    body: {
      bookingMode: "instant",
      vehicle: vehicleId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Pickup Location", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Drop Location", latitude: 30.7333, longitude: 76.7794 },
      goods: "Machinery parts",
      weight: { value: 300, unit: "kg" },
      preferredPickupDate: "2030-01-01",
      preferredPickupTime: "10:00"
    }
  };
  const res = createResponse();
  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(savedBooking);
  assert.equal(savedBooking.driver.toString(), driverId.toString());
  assert.equal(savedBooking.vehicle.toString(), vehicleId.toString());
  assert.equal(savedBooking.agency.toString(), agencyId.toString());
  assert.equal(savedBooking.assignmentStatus, "pending_acceptance");

  // Verify Agency Panel UI / filtering behavior
  assert.equal(matchesBookingFilter(savedBooking, "awaiting"), true);
  assert.equal(matchesBookingFilter(savedBooking, "unassigned"), false);

  // Verify Agency booking card does NOT show "Assign Driver & Fleet Vehicle"
  const hasAssignedDriver = Boolean(savedBooking.driver);
  const isPendingAcceptance = savedBooking.assignmentStatus === "pending_acceptance";
  const isUnassigned = !hasAssignedDriver && !isPendingAcceptance && ["unassigned", "rejected", undefined, null].includes(savedBooking.assignmentStatus);
  assert.equal(isUnassigned, false);
});

test("8. Scheduled booking automatically assigns vehicle's driver even if driver is currently offline", async (t) => {
  clearCache("booking.enabled");
  clearFareCache();
  mockIsolatedRouting(t);

  let savedBooking = null;
  t.mock.method(Booking.prototype, "save", async function save() {
    savedBooking = this;
    return this;
  });
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(User, "find", async () => []);
  // Driver is offline, which is allowed for future scheduled bookings
  const offlineDriver = {
    ...eligibleDriver,
    isOnline: false,
    user: { _id: driverUserId, role: "driver" }
  };
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      ...eligibleVehicle,
      driver: offlineDriver
    })
  }));
  t.mock.method(Vehicle, "findOneAndUpdate", async (filter) => ({
    _id: filter._id,
    isAvailable: false
  }));
  t.mock.method(Driver, "findById", () => ({
    populate: async () => offlineDriver
  }));
  t.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ role: "driver" }) })
  }));
  t.mock.method(Notification.prototype, "save", async function save() { return this; });

  const req = {
    user: { _id: customerId },
    body: {
      bookingMode: "scheduled",
      vehicle: vehicleId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Scheduled Pickup", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Scheduled Drop", latitude: 30.7333, longitude: 76.7794 },
      goods: "Textiles",
      weight: { value: 250, unit: "kg" },
      preferredPickupDate: "2030-05-15",
      preferredPickupTime: "14:30"
    }
  };
  const res = createResponse();
  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(savedBooking);
  assert.equal(savedBooking.driver.toString(), driverId.toString());
  assert.equal(savedBooking.vehicle.toString(), vehicleId.toString());
  assert.equal(savedBooking.assignmentStatus, "pending_acceptance");
  assert.equal(matchesBookingFilter(savedBooking, "awaiting"), true);
  assert.equal(matchesBookingFilter(savedBooking, "unassigned"), false);
});

test("9. Missing or ineligible driver leaves booking unassigned and shows Needs Assignment", async (t) => {
  clearCache("booking.enabled");
  clearFareCache();
  mockIsolatedRouting(t);

  let savedBooking = null;
  const savedNotifications = [];
  t.mock.method(Booking.prototype, "save", async function save() {
    savedBooking = this;
    return this;
  });
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(User, "find", async () => []);
  // Vehicle has NO driver assigned
  t.mock.method(Vehicle, "findById", () => ({
    populate: async () => ({
      ...eligibleVehicle,
      driver: null
    })
  }));
  t.mock.method(Notification.prototype, "save", async function save() {
    savedNotifications.push(this);
    return this;
  });

  const req = {
    user: { _id: customerId },
    body: {
      bookingMode: "instant",
      vehicle: vehicleId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Pickup Location", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Drop Location", latitude: 30.7333, longitude: 76.7794 },
      goods: "General Goods",
      weight: { value: 100, unit: "kg" },
      preferredPickupDate: "2030-01-01",
      preferredPickupTime: "10:00"
    }
  };
  const res = createResponse();
  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(savedBooking);
  assert.equal(savedBooking.driver, null);
  assert.equal(savedBooking.assignmentStatus, "unassigned");
  assert.equal(savedBooking.agency.toString(), agencyId.toString());

  // Agency Owner is notified
  assert.ok(savedNotifications.some((n) =>
    n.recipient?.toString() === agencyOwnerId.toString() &&
    n.title === "Booking Needs Assignment"
  ));

  // Agency Panel UI / filtering behavior
  assert.equal(matchesBookingFilter(savedBooking, "unassigned"), true);
  assert.equal(matchesBookingFilter(savedBooking, "awaiting"), false);

  // Agency booking card DOES show "Assign Driver & Fleet Vehicle"
  const hasAssignedDriver = Boolean(savedBooking.driver);
  const isPendingAcceptance = savedBooking.assignmentStatus === "pending_acceptance";
  const isUnassigned = !hasAssignedDriver && !isPendingAcceptance && ["unassigned", "rejected", undefined, null].includes(savedBooking.assignmentStatus);
  assert.equal(isUnassigned, true);
});
