import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Agency from "../src/models/Agency.js";
import Booking from "../src/models/Booking.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import {
  assignAgencyBooking,
  getAgencyBookings,
  getAgencyDrivers,
  getAgencyStats,
  getMyAgency,
  updateMyAgency
} from "../src/controllers/agencyController.js";

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
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("agency dashboard reads drivers only through the authenticated agency relationship", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  let driverFilter;
  t.mock.method(User, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: driverUserId }]); }
  }));
  t.mock.method(Agency, "findOne", async (filter) => {
    assert.deepEqual(filter, { owner: ownerId });
    return { _id: agencyId };
  });
  t.mock.method(Driver, "find", (filter) => {
    driverFilter = filter;
    return query([{
      _id: driverId,
      user: driverUserId,
      fullName: "Agency Driver",
      approvalStatus: "pending",
      isActive: true,
      documents: { idProof: {}, drivingLicense: {} },
      toObject() {
        return { ...this };
      }
    }]);
  });
  t.mock.method(Vehicle, "find", () => ({
    select() {
      return query([]);
    }
  }));

  const res = response();
  await getAgencyDrivers({ user: { _id: ownerId } }, res);

  assert.deepEqual(driverFilter, { agency: agencyId, user: { $in: [driverUserId] } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.drivers.length, 1);
  assert.equal(res.body.data.drivers[0]._id, driverId);
  assert.equal(res.body.data.drivers[0].approvalStatus, "pending");
});

test("agency dashboard returns the real scoped booking count even when only recent trips are returned", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  const bookings = [{ _id: new mongoose.Types.ObjectId() }];
  let bookingFilter;
  t.mock.method(User, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: driverUserId }]); }
  }));
  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId }));
  t.mock.method(Vehicle, "find", () => ({
    select() { return query([{ _id: vehicleId }]); }
  }));
  t.mock.method(Driver, "find", () => ({
    select() { return query([{ _id: driverId }]); }
  }));
  t.mock.method(Booking, "find", (filter) => {
    bookingFilter = filter;
    return query(bookings);
  });
  t.mock.method(Booking, "countDocuments", async (filter) => {
    assert.deepEqual(filter, bookingFilter);
    return 73;
  });

  const res = response();
  await getAgencyBookings({ user: { _id: ownerId } }, res);

  assert.deepEqual(bookingFilter, {
    $or: [
      { agency: agencyId },
      { vehicle: { $in: [vehicleId] } },
      { driver: { $in: [driverId] } }
    ]
  });
  assert.equal(res.body.data.bookings.length, 1);
  assert.deepEqual(res.body.data.pagination, { total: 73, returned: 1 });
});

test("agency driver statistics count only genuine agency-linked driver profiles", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const ownerUserId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  let driverFilter;
  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId }));
  t.mock.method(User, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: driverUserId }]); }
  }));
  t.mock.method(Driver, "find", (filter) => {
    driverFilter = filter;
    return query([{
      _id: new mongoose.Types.ObjectId(),
      user: driverUserId,
      approvalStatus: "pending",
      isActive: true,
      documents: { idProof: {}, drivingLicense: {} }
    }]);
  });

  const res = response();
  await getAgencyStats({ user: { _id: ownerId } }, res);

  assert.deepEqual(driverFilter, { agency: agencyId, user: { $in: [driverUserId] } });
  assert.equal(driverFilter.user.$in.includes(ownerUserId), false);
  assert.equal(res.body.data.counts.total, 1);
  assert.equal(res.body.data.counts.pendingAgency, 1);
});

test("agency owner account cannot be assigned to an agency booking", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Booking, "findById", async () => ({
    _id: bookingId,
    bookingStatus: "pending",
    driver: null,
    agency: agencyId
  }));
  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    user: { role: "agency" },
    agency: agencyId,
    agencyAssociation: { status: "approved" }
  }));
  const vehicleLookup = t.mock.method(Vehicle, "findOne", async () => ({
    _id: vehicleId,
    agency: agencyId,
    driver: driverId,
    isActive: true,
    isAvailable: true
  }));

  const res = response();
  await assignAgencyBooking({
    params: { id: bookingId.toString() },
    body: { driverId: driverId.toString(), vehicleId: vehicleId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /genuine driver accounts/i);
  assert.equal(vehicleLookup.mock.calls.length, 0);
});

test("agency profile reports missing Owner Aadhaar from the document reference, without leaking private URLs", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const agency = {
    _id: agencyId,
    agencyName: "Test Agency",
    approvalStatus: "approved",
    isActive: true,
    documents: {
      ownerAadhaar: { status: "pending", url: "", publicId: "" }
    },
    toObject() {
      return {
        _id: this._id,
        agencyName: this.agencyName,
        approvalStatus: this.approvalStatus,
        isActive: this.isActive,
        documents: this.documents
      };
    }
  };
  t.mock.method(Agency, "findOne", () => query(agency));

  const res = response();
  await getMyAgency({ user: { _id: new mongoose.Types.ObjectId() } }, res);

  const ownerAadhaar = res.body.data.agency.documents.ownerAadhaar;
  assert.equal(ownerAadhaar.status, "not_uploaded");
  assert.equal(ownerAadhaar.viewUrl, null);
  assert.equal("url" in ownerAadhaar, false);
  assert.equal("publicId" in ownerAadhaar, false);
});

test("agency profile update rejects client-submitted KYC status or document metadata", async (t) => {
  t.mock.method(Agency, "findOne", async () => ({ _id: new mongoose.Types.ObjectId() }));
  const update = t.mock.method(Agency, "findByIdAndUpdate", async () => ({}));

  const res = response();
  await updateMyAgency({
    user: { _id: new mongoose.Types.ObjectId() },
    body: {
      documents: { ownerAadhaar: { status: "approved" } }
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(update.mock.calls.length, 0);
});
