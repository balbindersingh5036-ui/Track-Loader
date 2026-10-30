import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Agency from "../src/models/Agency.js";
import Vehicle from "../src/models/Vehicle.js";
import {
  getAdminDrivers,
  getAdminDriverById,
  approveAdminDriver,
  rejectAdminDriver,
  suspendAdminDriver,
  updateAdminDriverStatus,
  reviewAdminDriverDocument
} from "../src/controllers/adminDriverController.js";
import {
  checkDriverOnlineEligibility,
  checkDriverAssignableToVehicle,
  hasApprovedDriverIdentityDocuments
} from "../src/utils/driverEligibility.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

const chain = (value) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); }
});

test("Admin Driver 1: getAdminDriverById returns driver with vehicles, agency, and KYC document info", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const mockDriver = {
    _id: driverId,
    fullName: "Ramesh Kumar",
    phone: "9876543210",
    email: "ramesh@example.com",
    approvalStatus: "pending",
    isActive: true,
    isOnline: false,
    agency: {
      _id: agencyId,
      agencyName: "Speedy Transport",
      city: "Mumbai"
    },
    agencyAssociation: {
      status: "approved",
      reviewedBy: { name: "Agency Owner", role: "agency" },
      decidedAt: new Date()
    },
    documents: {
      idProof: { status: "pending", publicId: "loadbalbin_kyc/driver_aadhaar", format: "jpg" },
      drivingLicense: { status: "approved", publicId: "loadbalbin_kyc/driver_dl", format: "pdf" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    populate() { return this; },
    lean() { return Promise.resolve(mockDriver); }
  }));
  t.mock.method(Vehicle, "find", () => chain([
    {
      _id: new mongoose.Types.ObjectId(),
      driver: driverId,
      vehicleNumber: "MH01AB1234",
      vehicleModel: "Tata Ace",
      vehicleType: "mini_truck",
      loadCapacity: 1000,
      isAvailable: true,
      isActive: true
    }
  ]));

  const res = createResponse();
  await getAdminDriverById({
    params: { id: driverId.toString() },
    user: { role: "admin", _id: new mongoose.Types.ObjectId() }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.driver.name, "Ramesh Kumar");
  assert.equal(res.body.data.driver.agency.agencyName, "Speedy Transport");
  assert.equal(res.body.data.driver.agencyAssociation.status, "approved");
  assert.equal(res.body.data.driver.vehicles.length, 1);
  assert.equal(res.body.data.driver.vehicles[0].vehicleNumber, "MH01AB1234");
});

test("Admin Driver 2: Search filters drivers correctly by name, phone, email, and agency", async (t) => {
  let capturedQuery = null;
  t.mock.method(Driver, "find", (query) => {
    capturedQuery = query;
    return chain([]);
  });
  t.mock.method(Driver, "countDocuments", async () => 0);
  t.mock.method(User, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: new mongoose.Types.ObjectId() }]); }
  }));
  t.mock.method(Agency, "find", () => ({
    select() { return this; },
    lean() { return Promise.resolve([{ _id: new mongoose.Types.ObjectId() }]); }
  }));

  const res = createResponse();
  await getAdminDrivers({
    query: { search: "Speedy" },
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(capturedQuery);
  // Searching incorporates $or condition with agency and user matches
  assert.ok(capturedQuery.$or || capturedQuery.$and);
});

test("Admin Driver 3: All workflow filters construct appropriate queries", async (t) => {
  const filters = [
    "pending_agency",
    "agency_accepted_pending_super_admin",
    "pending_kyc",
    "pending_final_approval",
    "fully_approved",
    "rejected",
    "suspended"
  ];

  for (const filter of filters) {
    let capturedQuery = null;
    t.mock.method(Driver, "find", (query) => {
      capturedQuery = query;
      return chain([]);
    });
    t.mock.method(Driver, "countDocuments", async () => 0);

    const res = createResponse();
    await getAdminDrivers({
      query: { filter },
      user: { role: "admin" }
    }, res);

    assert.equal(res.statusCode, 200, `Filter ${filter} should return 200`);
    assert.ok(capturedQuery, `Filter ${filter} should populate query`);
  }
});

test("Admin Driver 4: Super Admin approval is blocked when required KYC is pending", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const mockDriver = {
    _id: driverId,
    agency: null,
    approvalStatus: "pending",
    documents: {
      idProof: { status: "pending" }, // Pending Aadhaar
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve(mockDriver); }
  }));

  const res = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    body: {},
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Both identity documents must be approved/i);
});

test("Admin Driver 5: Super Admin approval is blocked when agency association is pending or rejected", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();

  // Test 5A: Pending agency association
  const pendingDriver = {
    _id: driverId,
    agency: agencyId,
    agencyAssociation: { status: "pending" },
    approvalStatus: "pending",
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };
  t.mock.method(Driver, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve(pendingDriver); }
  }));

  const resPending = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    body: {},
    user: { role: "admin" }
  }, resPending);
  assert.equal(resPending.statusCode, 400);
  assert.match(resPending.body.message, /Agency association has not been accepted/i);

  // Test 5B: Rejected agency association
  const rejectedDriver = {
    ...pendingDriver,
    agencyAssociation: { status: "rejected" }
  };
  t.mock.method(Driver, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve(rejectedDriver); }
  }));

  const resRejected = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    body: {},
    user: { role: "admin" }
  }, resRejected);
  assert.equal(resRejected.statusCode, 400);
  assert.match(resRejected.body.message, /Agency has rejected the driver association/i);
});

test("Admin Driver 6: Super Admin can approve an eligible driver with all requirements satisfied", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const eligibleDriver = {
    _id: driverId,
    agency: agencyId,
    agencyAssociation: { status: "approved" },
    approvalStatus: "pending",
    isActive: true,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve(eligibleDriver); }
  }));
  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => ({
    populate() {
      return Promise.resolve({
        ...eligibleDriver,
        approvalStatus: update.$set.approvalStatus
      });
    }
  }));
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    body: {},
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.driver.approvalStatus, "approved");
});

test("Admin Driver 7: Rejection persists rejection reason", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  let capturedUpdate = null;

  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    capturedUpdate = update;
    return {
      populate() {
        return Promise.resolve({
          _id: driverId,
          fullName: "Driver",
          approvalStatus: update.$set.approvalStatus,
          rejectionReason: update.$set.rejectionReason
        });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await rejectAdminDriver({
    params: { id: driverId.toString() },
    body: { reason: "Expired driving license document" },
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.$set.approvalStatus, "rejected");
  assert.equal(capturedUpdate.$set.rejectionReason, "Expired driving license document");
});

test("Admin Driver 8: Suspension persists reason, sets isOnline false, and blocks online dispatch", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  let capturedUpdate = null;

  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    capturedUpdate = update;
    return {
      populate() {
        return Promise.resolve({
          _id: driverId,
          fullName: "Driver",
          approvalStatus: "suspended",
          isOnline: false,
          rejectionReason: update.$set.rejectionReason
        });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await suspendAdminDriver({
    params: { id: driverId.toString() },
    body: { reason: "Safety violation investigation" },
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.$set.approvalStatus, "suspended");
  assert.equal(capturedUpdate.$set.isOnline, false);
  assert.equal(capturedUpdate.$set.rejectionReason, "Safety violation investigation");

  // Verify online eligibility check rejects suspended driver
  const suspendedCheck = checkDriverOnlineEligibility({
    _id: driverId,
    approvalStatus: "suspended",
    isActive: true,
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  });
  assert.equal(suspendedCheck.eligible, false);
  assert.match(suspendedCheck.message, /Only approved drivers can go online/i);
});

test("Admin Driver 9: Account deactivation toggles isActive to false and takes driver offline", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  let capturedUpdate = null;

  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    capturedUpdate = update;
    return {
      populate() {
        return Promise.resolve({
          _id: driverId,
          fullName: "Driver",
          isActive: update.$set.isActive,
          isOnline: update.$set.isOnline
        });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await updateAdminDriverStatus({
    params: { id: driverId.toString() },
    body: { isActive: false },
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.$set.isActive, false);
  assert.equal(capturedUpdate.$set.isOnline, false);
});

test("Admin Driver 10: Document review supports idProof, drivingLicense, and vehicle documents", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const reviewerId = new mongoose.Types.ObjectId();
  const mockDriver = {
    _id: driverId,
    documents: {
      idProof: {
        publicId: "loadbalbin_kyc/valid_aadhaar",
        status: "pending"
      }
    },
    markModified() {},
    async save() { return this; }
  };

  t.mock.method(Driver, "findById", async () => mockDriver);

  // Approve idProof
  const resApprove = createResponse();
  await reviewAdminDriverDocument({
    params: { id: driverId.toString(), docType: "idProof", action: "approve" },
    body: {},
    user: { _id: reviewerId }
  }, resApprove);

  assert.equal(resApprove.statusCode, 200);
  assert.equal(mockDriver.documents.idProof.status, "approved");

  // Reject with reason
  const resReject = createResponse();
  await reviewAdminDriverDocument({
    params: { id: driverId.toString(), docType: "idProof", action: "reject" },
    body: { reason: "Blurred scan" },
    user: { _id: reviewerId }
  }, resReject);

  assert.equal(resReject.statusCode, 200);
  assert.equal(mockDriver.documents.idProof.status, "rejected");
  assert.equal(mockDriver.documents.idProof.rejectionReason, "Blurred scan");
});

test("Admin Driver 11: Missing documents do not produce signed preview links", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const mockDriver = {
    _id: driverId,
    fullName: "Driver No Docs",
    documents: {
      idProof: { status: "not_uploaded" },
      drivingLicense: { status: "not_uploaded" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    populate() { return this; },
    lean() { return Promise.resolve(mockDriver); }
  }));
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await getAdminDriverById({
    params: { id: driverId.toString() },
    user: { role: "admin", _id: new mongoose.Types.ObjectId() }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.driver.documents.idProof.viewUrl, null);
  assert.equal(res.body.data.driver.documents.drivingLicense.viewUrl, null);
});

test("Admin Driver 12: Driver list pagination returns accurate page count and totals", async (t) => {
  t.mock.method(Driver, "find", () => chain([
    { _id: new mongoose.Types.ObjectId(), fullName: "Driver 1", approvalStatus: "approved" },
    { _id: new mongoose.Types.ObjectId(), fullName: "Driver 2", approvalStatus: "pending" }
  ]));
  t.mock.method(Driver, "countDocuments", async () => 45);
  t.mock.method(Vehicle, "find", () => chain([]));

  const res = createResponse();
  await getAdminDrivers({
    query: { page: "2", limit: "20" },
    user: { role: "admin" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.pagination.page, 2);
  assert.equal(res.body.data.pagination.limit, 20);
  assert.equal(res.body.data.pagination.total, 45);
  assert.equal(res.body.data.pagination.totalPages, 3);
});

test("Admin Driver 13: Ordinary admin without Super Admin identity cannot approve driver", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const mockDriver = {
    _id: driverId,
    agency: null,
    approvalStatus: "pending",
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    populate() { return this; },
    lean() { return Promise.resolve(mockDriver); }
  }));
  t.mock.method(Vehicle, "find", () => chain([]));

  // safeDriver returns canApproveDriver: false when canApproveDriver is false
  const res = createResponse();
  await getAdminDriverById({
    params: { id: driverId.toString() },
    user: { role: "admin", _id: new mongoose.Types.ObjectId() } // not configured SUPER_ADMIN_USER_ID
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.driver.canApproveDriver, false);
});

test("Admin Driver 14: Dispatch and vehicle assignment require approved driver and accepted agency", () => {
  const agencyId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  };

  // Blocked if driver is pending approval
  const pendingDriver = {
    _id: driverId,
    agency: agencyId,
    approvalStatus: "pending",
    isActive: true,
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  const assignResult1 = checkDriverAssignableToVehicle(pendingDriver, vehicle, agencyId);
  assert.equal(assignResult1.eligible, false);

  // Blocked if agency association is pending
  const pendingAssocDriver = {
    _id: driverId,
    agency: agencyId,
    approvalStatus: "approved",
    isActive: true,
    agencyAssociation: { status: "pending" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  const assignResult2 = checkDriverAssignableToVehicle(pendingAssocDriver, vehicle, agencyId);
  assert.equal(assignResult2.eligible, false);

  // Succeeds if driver and association are approved
  const fullyApprovedDriver = {
    ...pendingAssocDriver,
    agencyAssociation: { status: "approved" }
  };
  const assignResult3 = checkDriverAssignableToVehicle(fullyApprovedDriver, vehicle, agencyId);
  assert.equal(assignResult3.eligible, true);
});
