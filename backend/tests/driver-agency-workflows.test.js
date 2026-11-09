import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import Rating from "../src/models/Rating.js";
import Notification from "../src/models/Notification.js";
import {
  acceptBooking,
  completeTrip,
  getDriverBookings,
  getDriverRequests,
  startTrip
} from "../src/controllers/bookingController.js";
import { assignAgencyBooking } from "../src/controllers/agencyController.js";
import { getDriverRatings } from "../src/controllers/ratingController.js";

const response = () => ({
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

const query = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("Flow A: Complete Driver Lifecycle (Requests, Accept, Start, Complete, Ratings)", async (t) => {
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const customerUserId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  t.mock.method(Notification.prototype, "save", () => Promise.resolve({}));
  t.mock.method(User, "find", () => query([]));

  const mockDriver = {
    _id: driverId,
    user: { _id: driverUserId, role: "driver" },
    fullName: "Ramesh Sharma",
    phone: "9876543210",
    approvalStatus: "approved",
    isActive: true,
    isOnline: true,
    totalTrips: 10,
    rating: 4.8,
    ratingCount: 5,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const mockVehicle = {
    _id: vehicleId,
    vehicleNumber: "DL01AB9999",
    vehicleModel: "Tata Ace Gold",
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    driver: driverId,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  };

  const mockBooking = {
    _id: bookingId,
    bookingId: "LB-TEST-101",
    customer: customerUserId,
    driver: driverId,
    vehicle: vehicleId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    bookingMode: "instant",
    vehicleType: "mini-truck",
    weight: { value: 500, unit: "kg" },
    paymentMethod: "COD",
    paymentStatus: "pending",
    finalFare: 850,
    assignmentHistory: [],
    pickup: { address: "Sector 18, Noida", latitude: 28.57, longitude: 77.32 },
    drop: { address: "Connaught Place, Delhi", latitude: 28.63, longitude: 77.21 },
    save: async function() { return this; }
  };

  // 1. Test Driver Requests Fetch
  t.mock.method(Driver, "findOne", () => Promise.resolve(mockDriver));
  t.mock.method(Vehicle, "find", () => Promise.resolve([mockVehicle]));
  t.mock.method(Booking, "find", () => query([mockBooking]));
  t.mock.method(Booking, "countDocuments", () => Promise.resolve(1));

  const reqRequests = { user: { _id: driverUserId }, query: {} };
  const resRequests = response();
  await getDriverRequests(reqRequests, resRequests);

  assert.equal(resRequests.statusCode, 200);
  assert.equal(resRequests.body.success, true);
  assert.equal(resRequests.body.data.bookings.length, 1);
  assert.equal(resRequests.body.data.bookings[0].bookingId, "LB-TEST-101");

  // 2. Test Driver Accept Booking
  t.mock.method(Booking, "findOne", () => Promise.resolve(mockBooking));
  t.mock.method(Vehicle, "findOne", () => Promise.resolve(mockVehicle));
  t.mock.method(Vehicle, "updateOne", () => Promise.resolve({ modifiedCount: 1 }));
  t.mock.method(Booking, "findOneAndUpdate", () => {
    mockBooking.bookingStatus = "accepted";
    mockBooking.assignmentStatus = "accepted";
    return Promise.resolve(mockBooking);
  });

  const reqAccept = { user: { _id: driverUserId }, params: { id: bookingId.toString() } };
  const resAccept = response();
  await acceptBooking(reqAccept, resAccept);

  assert.equal(resAccept.statusCode, 200);
  assert.equal(resAccept.body.success, true);
  assert.equal(mockBooking.bookingStatus, "accepted");

  // 3. Test Driver Start Trip
  t.mock.method(Booking, "findOneAndUpdate", () => {
    mockBooking.bookingStatus = "in-progress";
    return Promise.resolve(mockBooking);
  });

  const reqStart = { user: { _id: driverUserId }, params: { id: bookingId.toString() } };
  const resStart = response();
  await startTrip(reqStart, resStart);

  assert.equal(resStart.statusCode, 200);
  assert.equal(resStart.body.success, true);
  assert.equal(resStart.body.data.booking.bookingStatus, "in-progress");

  // 4. Test Driver Complete Trip
  t.mock.method(Booking, "findOneAndUpdate", () => {
    mockBooking.bookingStatus = "completed";
    return Promise.resolve(mockBooking);
  });
  t.mock.method(Driver, "findByIdAndUpdate", () => Promise.resolve({}));
  t.mock.method(Vehicle, "findByIdAndUpdate", () => Promise.resolve({}));

  const reqComplete = { user: { _id: driverUserId }, params: { id: bookingId.toString() } };
  const resComplete = response();
  await completeTrip(reqComplete, resComplete);

  assert.equal(resComplete.statusCode, 200);
  assert.equal(resComplete.body.success, true);
  assert.equal(resComplete.body.data.booking.bookingStatus, "completed");

  // 5. Test Driver Ratings endpoint
  const mockRating = {
    _id: new mongoose.Types.ObjectId(),
    driver: driverId,
    customer: { name: "Aditya Roy", phone: "9123456789" },
    rating: 5,
    feedback: "Driver arrived quickly and handled goods safely.",
    createdAt: new Date()
  };

  t.mock.method(Rating, "find", () => query([mockRating]));
  t.mock.method(Rating, "countDocuments", () => Promise.resolve(1));

  const reqRatings = { user: { _id: driverUserId }, query: {} };
  const resRatings = response();
  await getDriverRatings(reqRatings, resRatings);

  assert.equal(resRatings.statusCode, 200);
  assert.equal(resRatings.body.success, true);
  assert.equal(resRatings.body.data.ratings.length, 1);
  assert.equal(resRatings.body.data.ratings[0].rating, 5);
  assert.equal(resRatings.body.data.summary.totalTrips, 10);

  // 6. Test Driver Bookings fetch (my bookings)
  const reqMyBookings = { user: { _id: driverUserId }, query: {} };
  const resMyBookings = response();
  await getDriverBookings(reqMyBookings, resMyBookings);

  assert.equal(resMyBookings.statusCode, 200);
  assert.equal(resMyBookings.body.success, true);
  assert.equal(resMyBookings.body.data.bookings.length, 1);
});

test("Flow B & C: Agency Driver/Vehicle Assignment and Scheduled Booking Workflow", async (t) => {
  const agencyOwnerUserId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const scheduledBookingId = new mongoose.Types.ObjectId();

  t.mock.method(Notification.prototype, "save", () => Promise.resolve({}));
  t.mock.method(User, "find", () => query([]));

  const mockAgency = {
    _id: agencyId,
    owner: agencyOwnerUserId,
    approvalStatus: "approved",
    isActive: true
  };

  const mockDriver = {
    _id: driverId,
    user: { _id: driverUserId, role: "driver" },
    agency: agencyId,
    approvalStatus: "approved",
    isActive: true,
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const mockVehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: driverId,
    vehicleType: "open",
    loadCapacity: { value: 3000, unit: "kg" },
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  };

  const mockScheduledBooking = {
    _id: scheduledBookingId,
    bookingId: "LB-SCHED-500",
    agency: agencyId,
    bookingMode: "scheduled",
    vehicleType: "open",
    weight: { value: 2000, unit: "kg" },
    preferredPickupDate: new Date(Date.now() + 86400000),
    preferredPickupTime: "10:00 AM",
    bookingStatus: "pending",
    assignmentStatus: "unassigned",
    assignmentHistory: [],
    save: async function() { return this; }
  };

  t.mock.method(Agency, "findOne", () => Promise.resolve(mockAgency));
  t.mock.method(Booking, "findById", () => Promise.resolve(mockScheduledBooking));
  t.mock.method(Driver, "findOne", () => Promise.resolve(mockDriver));
  t.mock.method(Vehicle, "findOne", () => Promise.resolve(mockVehicle));
  t.mock.method(Vehicle, "findOneAndUpdate", () => Promise.resolve(mockVehicle));
  t.mock.method(Booking, "findOneAndUpdate", () => Promise.resolve({
    ...mockScheduledBooking,
    driver: driverId,
    vehicle: vehicleId,
    assignmentStatus: "pending_acceptance",
    bookingStatus: "pending"
  }));

  const reqAssign = {
    user: { _id: agencyOwnerUserId },
    params: { id: scheduledBookingId.toString() },
    body: {
      driverId: driverId.toString(),
      vehicleId: vehicleId.toString()
    }
  };
  const resAssign = response();
  await assignAgencyBooking(reqAssign, resAssign);

  assert.equal(resAssign.statusCode, 200);
  assert.equal(resAssign.body.success, true);
  assert.equal(resAssign.body.data.booking.driver.toString(), driverId.toString());
  assert.equal(resAssign.body.data.booking.vehicle.toString(), vehicleId.toString());
  assert.equal(resAssign.body.data.booking.assignmentStatus, "pending_acceptance");
});
