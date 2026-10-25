import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Booking from "../src/models/Booking.js";
import Vehicle from "../src/models/Vehicle.js";
import Driver from "../src/models/Driver.js";
import Fare from "../src/models/Fare.js";
import Notification from "../src/models/Notification.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import { createBooking, acceptBooking } from "../src/controllers/bookingController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { clearFareCache } from "../src/services/fareService.js";

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

const customerId = new mongoose.Types.ObjectId();
const selectedVehicleId = new mongoose.Types.ObjectId();
const alternativeVehicleId = new mongoose.Types.ObjectId();
const approvedDriverUserId = new mongoose.Types.ObjectId();
const approvedDriverId = new mongoose.Types.ObjectId();

test("Instant booking assigns eligible same-type alternative vehicle and notifies driver", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking.prototype, "save", async function () {
    return this;
  });

  const savedNotifications = [];
  t.mock.method(Notification.prototype, "save", async function () {
    savedNotifications.push(this);
    return this;
  });
  t.mock.method(User, "find", async () => []);

  // Selected vehicle is unavailable
  t.mock.method(Vehicle, "findById", (id) => {
    const isPopulate = {
      populate: async () => ({
        _id: alternativeVehicleId,
        vehicleType: "mini-truck",
        documents: approvedVehicleDocuments,
        driver: { _id: approvedDriverId, user: approvedDriverUserId }
      }),
      then(resolve, reject) {
        if (id.toString() === selectedVehicleId.toString()) {
          return Promise.resolve({
            _id: selectedVehicleId,
            isActive: true,
            isAvailable: false,
            vehicleType: "mini-truck"
          }).then(resolve, reject);
        }
        return Promise.resolve({
          _id: alternativeVehicleId,
          vehicleType: "mini-truck",
          documents: approvedVehicleDocuments,
          driver: { _id: approvedDriverId, user: approvedDriverUserId }
        }).then(resolve, reject);
      }
    };
    return isPopulate;
  });

  // Candidate vehicle with approved driver and sufficient capacity
  t.mock.method(Vehicle, "find", () => mockQuery([
    {
      _id: alternativeVehicleId,
      vehicleType: "mini-truck",
      isActive: true,
      isAvailable: true,
      loadCapacity: { value: 500, unit: "kg" },
      documents: approvedVehicleDocuments,
      driver: {
        _id: approvedDriverId,
        user: approvedDriverUserId,
        approvalStatus: "approved",
        isActive: true,
        isOnline: true,
        documents: approvedDriverDocuments
      }
    }
  ]));

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
  assert.equal(res.body.data.alternativeAssigned, true);
  assert.equal(res.body.data.booking.vehicle.toString(), alternativeVehicleId.toString());
  assert.equal(res.body.data.booking.bookingMode, "instant");
  assert.equal(res.body.data.booking.alternativeVehicleAssigned, true);

  // Verify driver notification was sent
  const driverNotif = savedNotifications.find(n => n.recipient?.toString() === approvedDriverUserId.toString());
  assert.ok(driverNotif, "Driver should receive a notification for the booking request");
});

test("Instant booking excludes alternative vehicles with unapproved or inactive drivers", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);

  t.mock.method(Vehicle, "findById", async (id) => ({
    _id: selectedVehicleId,
    isActive: true,
    isAvailable: false,
    vehicleType: "mini-truck"
  }));

  // Candidate vehicle has pending/unapproved driver
  t.mock.method(Vehicle, "find", () => mockQuery([
    {
      _id: alternativeVehicleId,
      vehicleType: "mini-truck",
      isActive: true,
      isAvailable: true,
      loadCapacity: { value: 500, unit: "kg" },
      driver: {
        _id: approvedDriverId,
        user: approvedDriverUserId,
        approvalStatus: "pending", // NOT approved!
        isActive: true
      }
    }
  ]));

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

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /alternative/i);
});

test("Instant booking excludes alternative vehicles with insufficient load capacity", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);

  t.mock.method(Vehicle, "findById", async (id) => ({
    _id: selectedVehicleId,
    isActive: true,
    isAvailable: false,
    vehicleType: "mini-truck"
  }));

  // Candidate vehicle has capacity of only 50kg, but cargo is 100kg
  t.mock.method(Vehicle, "find", () => mockQuery([
    {
      _id: alternativeVehicleId,
      vehicleType: "mini-truck",
      isActive: true,
      isAvailable: true,
      loadCapacity: { value: 50, unit: "kg" }, // Insufficient!
      documents: approvedVehicleDocuments,
      driver: {
        _id: approvedDriverId,
        user: approvedDriverUserId,
        approvalStatus: "approved",
        isActive: true,
        documents: approvedDriverDocuments
      }
    }
  ]));

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

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /alternative/i);
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

  t.mock.method(Booking, "findById", async () => ({
    _id: bookingId,
    bookingStatus: "pending",
    vehicleType: "mini-truck"
  }));

  t.mock.method(Vehicle, "findOne", async () => ({
    _id: alternativeVehicleId,
    driver: approvedDriverId,
    isAvailable: true,
    isActive: true,
    documents: approvedVehicleDocuments
  }));

  // Atomic findOneAndUpdate fails because another concurrent request already accepted the booking
  t.mock.method(Booking, "findOneAndUpdate", async () => null);

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
        bookingMode: "scheduled"
      }
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.booking.bookingMode, "scheduled");
  assert.equal(res.body.data.booking.preferredPickupDate.toISOString().startsWith("2030-05-15"), true);
});
