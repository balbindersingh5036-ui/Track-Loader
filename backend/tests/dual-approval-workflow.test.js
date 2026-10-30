import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import { env } from "../src/config/env.js";
import { registerDriver } from "../src/controllers/authController.js";
import {
  acceptAgencyDriverRequest,
  rejectAgencyDriverRequest,
  getAgencyJoiningRequests
} from "../src/controllers/agencyController.js";
import {
  approveAdminDriver,
  reviewAdminDriverDocument
} from "../src/controllers/adminDriverController.js";
import { superAdminOnly } from "../src/middleware/superAdminMiddleware.js";
import { checkDriverOnlineEligibility } from "../src/utils/driverEligibility.js";
import { getDriverRequests } from "../src/controllers/bookingController.js";

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
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("Dual Approval 1: Registration with a verified agency", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  let createdDriver;
  t.mock.method(Agency, "findOne", () => mockQuery({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (d) => ({ _id: userId, ...d }));
  t.mock.method(Driver, "create", async (d) => {
    createdDriver = { _id: driverId, ...d };
    return createdDriver;
  });

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Harpreet Singh",
      phone: "+919876543210",
      password: "password123",
      agencyId: agencyId.toString()
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdDriver.approvalStatus, "pending");
  assert.equal(createdDriver.agency.toString(), agencyId.toString());
  assert.equal(createdDriver.agencyAssociation.status, "pending");
  assert.equal(createdDriver.agencyAssociation.rejectionReason, "");
  assert.equal(res.body.data.driver.approvalStatus, "pending");
  assert.equal(res.body.data.driver.agencyAssociation.status, "pending");
});

test("Dual Approval 2: Registration with independent-driver option", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  let createdDriver;
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (d) => ({ _id: userId, ...d }));
  t.mock.method(Driver, "create", async (d) => {
    createdDriver = { _id: driverId, ...d };
    return createdDriver;
  });

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Independent Ravi",
      phone: "+919876543211",
      password: "password123"
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdDriver.agency, null);
  assert.equal(createdDriver.agencyAssociation.status, "none");
  assert.equal(createdDriver.approvalStatus, "pending");
  assert.equal(res.body.data.driver.agency, null);
});

test("Dual Approval 3: Agency Admin accepts its own driver request", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  const driverDoc = {
    _id: driverId,
    fullName: "Harpreet Singh",
    agency: agencyId,
    approvalStatus: "pending",
    agencyAssociation: { status: "pending", rejectionReason: "", decidedAt: null, reviewedBy: null },
    documents: {
      idProof: { status: "pending" },
      drivingLicense: { status: "pending" }
    },
    async save() {
      return this;
    }
  };

  t.mock.method(Agency, "findOne", async (q) => {
    if (q.owner?.toString() === agencyOwnerId.toString()) {
      return { _id: agencyId, owner: agencyOwnerId, approvalStatus: "approved", isActive: true };
    }
    return null;
  });
  t.mock.method(Driver, "findById", async () => driverDoc);

  const res = createResponse();
  await acceptAgencyDriverRequest({
    user: { _id: agencyOwnerId, role: "agency" },
    params: { id: driverId.toString() }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(driverDoc.agencyAssociation.status, "approved");
  assert.equal(driverDoc.agencyAssociation.reviewedBy.toString(), agencyOwnerId.toString());
  assert.ok(driverDoc.agencyAssociation.decidedAt instanceof Date);
  assert.equal(driverDoc.approvalStatus, "pending"); // Super Admin approval remains pending!
  assert.equal(driverDoc.documents.idProof.status, "pending"); // KYC remains pending!
});

test("Dual Approval 4: Agency Admin rejects its own request with a reason", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  const driverDoc = {
    _id: driverId,
    fullName: "Harpreet Singh",
    agency: agencyId,
    approvalStatus: "pending",
    agencyAssociation: { status: "pending", rejectionReason: "", decidedAt: null, reviewedBy: null },
    async save() {
      return this;
    }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, owner: agencyOwnerId }));
  t.mock.method(Driver, "findById", async () => driverDoc);

  // Missing reason fails with 400
  const failRes = createResponse();
  await rejectAgencyDriverRequest({
    user: { _id: agencyOwnerId, role: "agency" },
    params: { id: driverId.toString() },
    body: { reason: "   " }
  }, failRes);
  assert.equal(failRes.statusCode, 400);

  // Valid rejection with reason
  const res = createResponse();
  await rejectAgencyDriverRequest({
    user: { _id: agencyOwnerId, role: "agency" },
    params: { id: driverId.toString() },
    body: { reason: "Fleet driver capacity reached for mini-trucks" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(driverDoc.agencyAssociation.status, "rejected");
  assert.equal(driverDoc.agencyAssociation.rejectionReason, "Fleet driver capacity reached for mini-trucks");
  assert.equal(driverDoc.agencyAssociation.reviewedBy.toString(), agencyOwnerId.toString());
  assert.ok(driverDoc.agencyAssociation.decidedAt instanceof Date);

  // Duplicate decision is rejected
  const dupRes = createResponse();
  await rejectAgencyDriverRequest({
    user: { _id: agencyOwnerId, role: "agency" },
    params: { id: driverId.toString() },
    body: { reason: "Another reason" }
  }, dupRes);
  assert.equal(dupRes.statusCode, 400);
});

test("Dual Approval 5: Wrong agency cannot approve another agency's request", async (t) => {
  const agencyAId = new mongoose.Types.ObjectId();
  const agencyBId = new mongoose.Types.ObjectId();
  const agencyAOwnerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  const driverDoc = {
    _id: driverId,
    agency: agencyBId, // Registered with Agency B
    agencyAssociation: { status: "pending" }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyAId, owner: agencyAOwnerId }));
  t.mock.method(Driver, "findById", async () => driverDoc);

  const resAccept = createResponse();
  await acceptAgencyDriverRequest({
    user: { _id: agencyAOwnerId, role: "agency" },
    params: { id: driverId.toString() }
  }, resAccept);
  assert.equal(resAccept.statusCode, 403);

  const resReject = createResponse();
  await rejectAgencyDriverRequest({
    user: { _id: agencyAOwnerId, role: "agency" },
    params: { id: driverId.toString() },
    body: { reason: "Cannot approve driver of Agency B" }
  }, resReject);
  assert.equal(resReject.statusCode, 403);
});

test("Dual Approval 6: Agency acceptance does not automatically approve KYC", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const agencyOwnerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  const driverDoc = {
    _id: driverId,
    agency: agencyId,
    approvalStatus: "pending",
    agencyAssociation: { status: "pending" },
    documents: {
      idProof: { status: "not_uploaded" },
      drivingLicense: { status: "pending" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, owner: agencyOwnerId }));
  t.mock.method(Driver, "findById", async () => driverDoc);

  const res = createResponse();
  await acceptAgencyDriverRequest({
    user: { _id: agencyOwnerId, role: "agency" },
    params: { id: driverId.toString() }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(driverDoc.agencyAssociation.status, "approved");
  assert.equal(driverDoc.approvalStatus, "pending");
  assert.equal(driverDoc.documents.idProof.status, "not_uploaded");
  assert.equal(driverDoc.documents.drivingLicense.status, "pending");
});

test("Dual Approval 7: Ordinary admin cannot perform Super Admin approval", (t) => {
  const previous = env.superAdminUserId;
  t.after(() => {
    env.superAdminUserId = previous;
  });
  const designatedSuperAdminId = new mongoose.Types.ObjectId();
  env.superAdminUserId = designatedSuperAdminId.toString();

  const ordinaryAdminId = new mongoose.Types.ObjectId();
  const res = createResponse();
  let nextCalled = false;

  superAdminOnly({ user: { _id: ordinaryAdminId, role: "admin" } }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("Dual Approval 8: Only designated Super Admin can approve documents and final driver status", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const superAdminId = new mongoose.Types.ObjectId();

  const driverDoc = {
    _id: driverId,
    agency: agencyId,
    approvalStatus: "pending",
    agencyAssociation: { status: "pending" }, // Agency has NOT approved yet!
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Driver, "findById", () => ({
    select() {
      return {
        lean: async () => driverDoc
      };
    }
  }));

  // Attempting final approval before agency acceptance fails with 400
  const resBeforeAgency = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    user: { _id: superAdminId, role: "admin" },
    body: {}
  }, resBeforeAgency);

  assert.equal(resBeforeAgency.statusCode, 400);
  assert.match(resBeforeAgency.body.message, /agency admin/i);

  // Agency rejected -> Super Admin final approval is also blocked
  driverDoc.agencyAssociation.status = "rejected";
  const resRejectedAgency = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    user: { _id: superAdminId, role: "admin" },
    body: {}
  }, resRejectedAgency);

  assert.equal(resRejectedAgency.statusCode, 400);
  assert.match(resRejectedAgency.body.message, /rejected/i);

  // Once agency approves association AND docs are approved -> Super Admin approval succeeds!
  driverDoc.agencyAssociation.status = "approved";
  let updatedDoc;
  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    updatedDoc = update;
    return {
      populate() {
        return Promise.resolve({
          _id: id,
          agency: agencyId,
          agencyAssociation: { status: "approved" },
          approvalStatus: update.$set.approvalStatus,
          documents: driverDoc.documents,
          user: { name: "Approved Driver" }
        });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => mockQuery([]));

  const resSuccess = createResponse();
  await approveAdminDriver({
    params: { id: driverId.toString() },
    user: { _id: superAdminId, role: "admin" },
    body: {}
  }, resSuccess);

  assert.equal(resSuccess.statusCode, 200);
  assert.equal(updatedDoc.$set.approvalStatus, "approved");
});

test("Dual Approval 9: Driver cannot go online after only one approval", async () => {
  const agencyId = new mongoose.Types.ObjectId();

  const driver = {
    agency: agencyId,
    isActive: true,
    approvalStatus: "pending", // Super admin pending
    agencyAssociation: { status: "approved" }, // Agency approved
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const agency = {
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  };

  const vehicles = [{
    isActive: true,
    isAvailable: true,
    agency: agencyId,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  }];

  // 1. Agency approved, Super Admin pending -> NOT eligible
  const test1 = checkDriverOnlineEligibility(driver, vehicles, agency);
  assert.equal(test1.eligible, false);

  // 2. Super Admin approved, Agency pending -> NOT eligible
  driver.approvalStatus = "approved";
  driver.agencyAssociation.status = "pending";
  const test2 = checkDriverOnlineEligibility(driver, vehicles, agency);
  assert.equal(test2.eligible, false);

  // 3. Super Admin approved, Agency rejected -> NOT eligible
  driver.agencyAssociation.status = "rejected";
  driver.agencyAssociation.rejectionReason = "Contact mismatch";
  const test3 = checkDriverOnlineEligibility(driver, vehicles, agency);
  assert.equal(test3.eligible, false);

  // 4. Both approvals present, but vehicle has unapproved insurance -> NOT eligible
  driver.agencyAssociation.status = "approved";
  vehicles[0].documents.insurance.status = "pending";
  const test4 = checkDriverOnlineEligibility(driver, vehicles, agency);
  assert.equal(test4.eligible, false);

  // 5. All 8 conditions satisfied -> Eligible!
  vehicles[0].documents.insurance.status = "approved";
  const test5 = checkDriverOnlineEligibility(driver, vehicles, agency);
  assert.equal(test5.eligible, true);
});

test("Dual Approval 10: Driver cannot receive bookings until all eligibility conditions are satisfied", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: userId,
    isActive: true,
    approvalStatus: "approved",
    agency: agencyId,
    agencyAssociation: { status: "pending" }, // Pending agency approval!
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Agency, "findById", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));

  const res = createResponse();
  await getDriverRequests({ user: { _id: userId }, query: {} }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /Agency association/i);
});

test("Dual Approval 11: Fully approved and eligible driver can access dispatch", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: userId,
    isActive: true,
    approvalStatus: "approved",
    agency: agencyId,
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicles = [{
    _id: new mongoose.Types.ObjectId(),
    driver: driverId,
    vehicleType: "mini-truck",
    agency: agencyId,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  }];

  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Agency, "findById", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "find", async () => vehicles);
  t.mock.method(Booking, "find", () => mockQuery([]));
  t.mock.method(Booking, "countDocuments", async () => 0);

  const res = createResponse();
  await getDriverRequests({ user: { _id: userId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.bookings, []);
});

test("Dual Approval 12: Independent driver does not require agency association approval", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: userId,
    isActive: true,
    approvalStatus: "approved",
    agency: null, // Independent
    agencyAssociation: { status: "none" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicles = [{
    _id: new mongoose.Types.ObjectId(),
    driver: driverId,
    vehicleType: "mini-truck",
    agency: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  }];

  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Vehicle, "find", async () => vehicles);
  t.mock.method(Booking, "find", () => mockQuery([]));
  t.mock.method(Booking, "countDocuments", async () => 0);

  // 1. Can receive booking requests without agency association
  const res = createResponse();
  await getDriverRequests({ user: { _id: userId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  // 2. Can go online without agency association
  const onlineEligibility = checkDriverOnlineEligibility(driver, vehicles, null);
  assert.equal(onlineEligibility.eligible, true);
});

