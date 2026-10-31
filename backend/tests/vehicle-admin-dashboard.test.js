import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Booking from "../src/models/Booking.js";
import Vehicle from "../src/models/Vehicle.js";
import {
  getAdminVehicles,
  reviewAdminVehicleDocument,
  getAdminVehicleById,
  updateAdminVehicleStatus
} from "../src/controllers/vehicleController.js";

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

const query = (value) => ({
  populate() { return this; },
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); }
});

test("admin vehicle list applies search, category, assignment, status, sorting and pagination filters", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  let listFilter;
  let countFilter;
  let sortValue;
  let pageSkip;
  let pageLimit;
  const statisticFilters = [];
  t.mock.method(Driver, "find", () => ({
    select() { return this; },
    lean: async () => [{ _id: driverId }]
  }));
  t.mock.method(Agency, "find", () => ({
    select() { return this; },
    lean: async () => [{ _id: agencyId }]
  }));
  t.mock.method(Vehicle, "find", (filter) => {
    listFilter = filter;
    return {
      populate() { return this; },
      sort(value) { sortValue = value; return this; },
      skip(value) { pageSkip = value; return this; },
      limit(value) { pageLimit = value; return this; },
      lean: async () => [{ _id: "vehicle-1" }]
    };
  });
  let counter = 0;
  t.mock.method(Vehicle, "countDocuments", async (filter) => {
    if (counter++ < 9) {
      statisticFilters.push(filter);
      return counter;
    }
    countFilter = filter;
    return 32;
  });

  const res = createResponse();
  await getAdminVehicles({
    query: {
      page: "2",
      limit: "10",
      search: "north",
      status: "active",
      assigned: "true",
      availability: "true",
      vehicleType: "pickup",
      registrationStatus: "pending",
      insuranceStatus: "approved",
      sortBy: "vehicleNumber",
      sortOrder: "asc"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.pagination.total, 32);
  assert.deepEqual(res.body.data.stats, {
    total: 1,
    active: 2,
    inactive: 3,
    available: 4,
    assigned: 5,
    pendingRegistration: 6,
    pendingInsurance: 7,
    rejectedDocuments: 17
  });
  assert.equal(pageSkip, 10);
  assert.equal(pageLimit, 10);
  assert.deepEqual(sortValue, { vehicleNumber: 1 });
  assert.equal(listFilter.isActive, true);
  assert.equal(listFilter.driver.$exists, true);
  assert.ok(listFilter.$or.some((condition) => condition.driver?.$in?.[0]?.toString() === driverId.toString()));
  assert.ok(listFilter.$or.some((condition) => condition.agency?.$in?.[0]?.toString() === agencyId.toString()));
  assert.equal(listFilter.isAvailable, true);
  assert.equal(listFilter.vehicleType, "pickup");
  assert.ok(listFilter.$and.some((condition) =>
    condition.$or?.some((entry) => entry["documents.registration.status"] === "pending")
  ));
  assert.equal(listFilter["documents.insurance.status"], "approved");
  assert.ok(statisticFilters[5].$or[1].$and[0]["documents.registration.status"].$exists === false);
  assert.deepEqual(countFilter, listFilter);
});

test("admin vehicle listing rejects unsupported filters and sort fields", async () => {
  const res = createResponse();
  await getAdminVehicles({ query: { status: "suspended" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /status must be active or inactive/i);

  const invalidSort = createResponse();
  await getAdminVehicles({ query: { sortBy: "agency.owner.password" } }, invalidSort);
  assert.equal(invalidSort.statusCode, 400);
});

test("missing RC filter includes records with no document status", async (t) => {
  let capturedFilter;
  t.mock.method(Vehicle, "find", (filter) => {
    capturedFilter = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => []
    };
  });
  t.mock.method(Vehicle, "countDocuments", async () => 0);
  const res = createResponse();

  await getAdminVehicles({ query: { registrationStatus: "missing" } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(capturedFilter.$and[0].$or.some((condition) => condition["documents.registration.status"]?.$exists === false));
  assert.ok(capturedFilter.$and[0].$or.some((condition) => condition["documents.registration.publicId"]));
});

test("admin vehicle detail response omits signed preview URLs while populating associated records", async (t) => {
  let populated = 0;
  const vehicle = {
    _id: new mongoose.Types.ObjectId(),
    driver: { _id: new mongoose.Types.ObjectId(), fullName: "Actual Driver" },
    agency: { _id: new mongoose.Types.ObjectId(), agencyName: "Test Agency" },
    documents: {
      registration: { url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/rc.png", status: "pending" },
      insurance: { url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/insurance.pdf", status: "pending" }
    }
  };
  t.mock.method(Vehicle, "findById", () => ({
    populate() { populated += 1; return this; },
    lean: async () => vehicle
  }));
  const res = createResponse();

  await getAdminVehicleById({ params: { id: vehicle._id.toString() }, user: { role: "admin", _id: new mongoose.Types.ObjectId() } }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(populated >= 7);
  assert.equal(res.body.data.vehicle.documents.registration.viewUrl, null);
  assert.equal(res.body.data.vehicle.documents.insurance.viewUrl, null);
  assert.equal(res.body.data.vehicle.canReviewDocuments, false);
  assert.equal(res.body.data.vehicle.canViewDocuments, false);
});

test("document approval records independent status history and rejects stale review states", async (t) => {
  const vehicleId = new mongoose.Types.ObjectId();
  const reviewerId = new mongoose.Types.ObjectId();
  const document = {
    url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/rc.png",
    publicId: "loadbalbin_kyc/rc",
    status: "pending",
    reviewHistory: [],
    rejectionReason: ""
  };
  const vehicle = {
    _id: vehicleId,
    documents: { registration: document },
    markModified() {},
    save: async () => {}
  };
  t.mock.method(Vehicle, "findById", async () => vehicle);

  const res = createResponse();
  await reviewAdminVehicleDocument({
    params: { id: vehicleId.toString(), docType: "registration", action: "approve" },
    body: {},
    user: { _id: reviewerId }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(document.status, "approved");
  assert.equal(document.reviewHistory.length, 1);
  assert.equal(document.reviewHistory[0].previousStatus, "pending");
  assert.equal(document.reviewHistory[0].newStatus, "approved");

  const staleReview = createResponse();
  await reviewAdminVehicleDocument({
    params: { id: vehicleId.toString(), docType: "registration", action: "reject" },
    body: { reason: "Issue" },
    user: { _id: reviewerId }
  }, staleReview);
  assert.equal(staleReview.statusCode, 409);
  assert.equal(document.reviewHistory.length, 1);
});

test("vehicle activation requires approved documents and preserves active booking and assignment constraints", async (t) => {
  const vehicleId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    isActive: false,
    isAvailable: true,
    driver: null,
    agency: null,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    },
    async save() { return this; }
  };
  t.mock.method(Vehicle, "findById", async () => vehicle);
  t.mock.method(Booking, "exists", async () => null);

  const activated = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, activated);
  assert.equal(activated.statusCode, 200);
  assert.equal(vehicle.isActive, true);

  vehicle.isActive = false;
  vehicle.documents.registration.status = "pending";
  const missingApproval = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, missingApproval);
  assert.equal(missingApproval.statusCode, 409);

  vehicle.documents.registration.status = "approved";
  vehicle.isActive = true;
  vehicle.driver = new mongoose.Types.ObjectId();
  const driverAssigned = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: false }
  }, driverAssigned);
  assert.equal(driverAssigned.statusCode, 409);
  assert.match(driverAssigned.body.message, /unassign the driver/i);
});

test("vehicle status cannot change while an active booking or assignment exists", async (t) => {
  const vehicleId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    isActive: true,
    driver: null,
    documents: {
      registration: { status: "approved", publicId: "loadbalbin_kyc/registration" },
      insurance: { status: "approved", publicId: "loadbalbin_kyc/insurance" }
    },
    async save() { return this; }
  };
  t.mock.method(Vehicle, "findById", async () => vehicle);
  t.mock.method(Booking, "exists", async (filter) => {
    assert.equal(filter.vehicle.toString(), vehicleId.toString());
    return { _id: new mongoose.Types.ObjectId() };
  });
  const res = createResponse();

  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: false }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /active booking or assignment/i);
  assert.equal(vehicle.isActive, true);
});

test("vehicle activation validates the assigned Driver and its managing Agency", async (t) => {
  const vehicleId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    isActive: false,
    isAvailable: true,
    driver: driverId,
    agency: agencyId,
    documents: {
      registration: { status: "approved", publicId: "loadbalbin_kyc/registration" },
      insurance: { status: "approved", publicId: "loadbalbin_kyc/insurance" }
    },
    async save() { return this; }
  };
  const driver = {
    _id: driverId,
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  t.mock.method(Vehicle, "findById", async () => vehicle);
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(Agency, "findById", async () => ({ _id: agencyId, isActive: true, approvalStatus: "approved" }));
  t.mock.method(Driver, "findById", async () => driver);

  const eligibleRes = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, eligibleRes);
  assert.equal(eligibleRes.statusCode, 200);
  assert.equal(vehicle.isActive, true);

  vehicle.isActive = false;
  driver.documents.drivingLicense.status = "pending";
  const ineligibleRes = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, ineligibleRes);
  assert.equal(ineligibleRes.statusCode, 409);
  assert.match(ineligibleRes.body.message, /Aadhaar and Driving Licence/i);
});
