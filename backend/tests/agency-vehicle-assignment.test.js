import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import {
  assignVehicleDriver,
  createAgencyVehicle,
  updateAgencyVehicle
} from "../src/controllers/agencyController.js";
import {
  isDriverAssignableToVehicle,
  isDriverEligibleForDispatch,
  checkDriverAssignableToVehicle,
  checkDriverEligibleForDispatch
} from "../src/utils/driverEligibility.js";

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

const mockDriverUserRole = (t, role = "driver") => {
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean() { return Promise.resolve({ role }); }
  }));
};

test("Agency Vehicle Assignment 1: Pending agency association blocked", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "pending" }, // Pending agency approval
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved", url: "https://example.com/rc.pdf" },
      insurance: { status: "approved", url: "https://example.com/ins.pdf" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async () => vehicle);
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /agency association/i);
  assert.equal(vehicle.driver, null);
  assert.equal(isDriverAssignableToVehicle(driver, vehicle, { _id: agencyId }), false);
});

test("Agency Vehicle Assignment 2: Pending Super Admin approval blocked", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "pending", // Pending Super Admin verification
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved", url: "https://example.com/rc.pdf" },
      insurance: { status: "approved", url: "https://example.com/ins.pdf" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async () => vehicle);
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /Super Admin/i);
  assert.equal(vehicle.driver, null);
  assert.equal(isDriverAssignableToVehicle(driver, vehicle, { _id: agencyId }), false);
});

test("Agency Vehicle Assignment 3: Pending Aadhaar or Driving Licence blocked", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  // Case A: Aadhaar pending
  const driverAadhaarPending = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "pending" }, // Pending
      drivingLicense: { status: "approved" }
    }
  };

  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved", url: "https://example.com/rc.pdf" },
      insurance: { status: "approved", url: "https://example.com/ins.pdf" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async (filter) =>
    filter._id?.$ne ? null : vehicle
  );
  t.mock.method(Driver, "findOne", async () => driverAadhaarPending);

  const resA = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, resA);

  assert.equal(resA.statusCode, 403);
  assert.match(resA.body.message, /Aadhaar and Driving Licence/i);

  // Case B: DL rejected
  const driverDlRejected = {
    ...driverAadhaarPending,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "rejected" }
    }
  };
  t.mock.method(Driver, "findOne", async () => driverDlRejected);

  const resB = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, resB);

  assert.equal(resB.statusCode, 403);
  assert.match(resB.body.message, /Aadhaar and Driving Licence/i);
});

test("Agency Vehicle Assignment 4: Driver can be linked before vehicle documents are approved", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicleMissingRc = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "not_uploaded" }, // Missing RC
      insurance: { status: "approved" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async (filter) =>
    filter._id?.$ne ? null : vehicleMissingRc
  );
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(vehicleMissingRc.driver.toString(), driverId.toString());
  assert.equal(isDriverAssignableToVehicle(driver, vehicleMissingRc, { _id: agencyId }), true);
  assert.equal(isDriverEligibleForDispatch(driver, vehicleMissingRc, { _id: agencyId }), false);
});

test("Agency Vehicle Assignment 5: Fully approved driver and eligible vehicle assignment succeeds", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    fullName: "Approved Driver",
    phone: "+919876543210",
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  const vehicle = {
    _id: vehicleId,
    vehicleNumber: "PB02AB1234",
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved", url: "https://example.com/rc.pdf" },
      insurance: { status: "approved", url: "https://example.com/ins.pdf" }
    },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async (filter) => {
    if (filter._id && filter._id.toString() === vehicleId.toString()) {
      return vehicle;
    }
    // Conflicting vehicle check returns null
    return null;
  });
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(vehicle.driver.toString(), driverId.toString());
  assert.equal(isDriverAssignableToVehicle(driver, vehicle, { _id: agencyId }), true);
});

test("Agency Vehicle Assignment 6: Cross-agency assignment returns 403", async (t) => {
  mockDriverUserRole(t);
  const myAgencyId = new mongoose.Types.ObjectId();
  const otherAgencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({ _id: myAgencyId, approvalStatus: "approved", isActive: true }));

  // 1. Vehicle belongs to other agency
  const foreignVehicle = {
    _id: vehicleId,
    agency: otherAgencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } }
  };
  t.mock.method(Vehicle, "findOne", async (filter) =>
    filter._id?.$ne ? null : foreignVehicle
  );

  const resVeh = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, resVeh);

  assert.equal(resVeh.statusCode, 403);
  assert.match(resVeh.body.message, /another agency/i);

  // 2. Driver belongs to other agency
  const ownVehicle = {
    _id: vehicleId,
    agency: myAgencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } }
  };
  const foreignDriver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: otherAgencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  t.mock.method(Vehicle, "findOne", async (filter) =>
    filter._id?.$ne ? null : ownVehicle
  );
  t.mock.method(Driver, "findOne", async () => foreignDriver);

  const resDrv = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, resDrv);

  assert.equal(resDrv.statusCode, 403);
  assert.match(resDrv.body.message, /another agency/i);
});

test("Agency Vehicle Assignment 7: Duplicate assignment is handled correctly", async (t) => {
  mockDriverUserRole(t);
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };

  const vehicleAlreadyAssigned = {
    _id: vehicleId,
    agency: agencyId,
    driver: driverId, // Already assigned to this exact driver!
    isActive: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async () => vehicleAlreadyAssigned);
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /already assigned/i);
});

test("Agency Vehicle Assignment blocks an agency owner account", async (t) => {
  mockDriverUserRole(t, "agency");
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    isAvailable: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } }
  };
  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async () => vehicle);
  t.mock.method(Driver, "findOne", async () => driver);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /genuine driver accounts/i);
  assert.equal(vehicle.driver, null);
});

test("Agency Vehicle Assignment 8: Assigned driver and vehicle relationships persist correctly", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  // Test Unassigning
  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: driverId,
    isActive: true,
    isAvailable: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } },
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId, approvalStatus: "approved", isActive: true }));
  t.mock.method(Vehicle, "findOne", async () => vehicle);

  const res = createResponse();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: null },
    user: { _id: ownerId }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(vehicle.driver, null);
});

test("Agency Vehicle Assignment 9: Dispatch eligibility remains enforced after assignment", () => {
  const agencyId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const driver = {
    _id: driverId,
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };

  const agency = {
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  };

  // Case A: Assigned, available, approved -> Dispatch ready
  const dispatchReadyVehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: driverId,
    isActive: true,
    isAvailable: true,
    documents: { registration: { status: "approved" }, insurance: { status: "approved" } }
  };

  assert.equal(isDriverEligibleForDispatch(driver, dispatchReadyVehicle, agency), true);

  // Case B: Unassigned vehicle -> Not dispatch ready
  const unassignedVehicle = {
    ...dispatchReadyVehicle,
    driver: null
  };
  assert.equal(isDriverEligibleForDispatch(driver, unassignedVehicle, agency), false);

  // Case C: Unavailable (on trip) vehicle -> Not dispatch ready
  const busyVehicle = {
    ...dispatchReadyVehicle,
    isAvailable: false
  };
  assert.equal(isDriverEligibleForDispatch(driver, busyVehicle, agency), false);

  // Case D: Vehicle documents not approved -> Not dispatch ready
  const unverifiedVehicle = {
    ...dispatchReadyVehicle,
    documents: { registration: { status: "pending" }, insurance: { status: "approved" } }
  };
  assert.equal(isDriverEligibleForDispatch(driver, unverifiedVehicle, agency), false);
});

test("Vehicle registration saves an eligible same-agency driver relationship", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  let createdVehicle;

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean: async () => ({ role: "driver" })
  }));
  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Vehicle, "findOne", async () => null);
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicle = data;
    return { _id: new mongoose.Types.ObjectId(), ...data };
  });

  const res = createResponse();
  await createAgencyVehicle({
    user: { _id: ownerId },
    body: {
      vehicleNumber: "PB10AB1234",
      vehicleModel: "Tata Ace Gold",
      vehicleType: "mini-truck",
      loadCapacity: { value: 1000, unit: "kg" },
      driverId: driverId.toString()
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdVehicle.driver.toString(), driverId.toString());
});

test("Editing a vehicle can change or remove its assigned driver", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const replacementDriverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    vehicleNumber: "PB10AB1234",
    vehicleMake: "Tata",
    vehicleModel: "Tata Ace Gold",
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    bodyType: "open",
    vehicleImage: "",
    vehicleImages: [],
    isActive: true,
    isAvailable: true,
    async save() { return this; }
  };
  const driver = {
    _id: driverId,
    user: new mongoose.Types.ObjectId(),
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    agencyAssociation: { status: "approved" },
    documents: { idProof: { status: "approved" }, drivingLicense: { status: "approved" } }
  };
  const replacementDriver = {
    ...driver,
    _id: replacementDriverId,
    user: new mongoose.Types.ObjectId()
  };

  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId }));
  t.mock.method(User, "findById", () => ({
    select() { return this; },
    lean: async () => ({ role: "driver" })
  }));
  t.mock.method(Driver, "findOne", async (filter) =>
    filter._id.toString() === replacementDriverId.toString() ? replacementDriver : driver
  );
  t.mock.method(Vehicle, "findOne", async (filter) =>
    filter._id?.$ne ? null : vehicle
  );

  const assignResponse = createResponse();
  await updateAgencyVehicle({
    params: { id: vehicleId.toString() },
    user: { _id: ownerId },
    body: { driverId: driverId.toString() },
    files: []
  }, assignResponse);
  assert.equal(assignResponse.statusCode, 200);
  assert.equal(vehicle.driver.toString(), driverId.toString());

  const changeResponse = createResponse();
  await updateAgencyVehicle({
    params: { id: vehicleId.toString() },
    user: { _id: ownerId },
    body: { driverId: replacementDriverId.toString() },
    files: []
  }, changeResponse);
  assert.equal(changeResponse.statusCode, 200);
  assert.equal(vehicle.driver.toString(), replacementDriverId.toString());

  const unassignResponse = createResponse();
  await updateAgencyVehicle({
    params: { id: vehicleId.toString() },
    user: { _id: ownerId },
    body: { driverId: "" },
    files: []
  }, unassignResponse);
  assert.equal(unassignResponse.statusCode, 200);
  assert.equal(vehicle.driver, null);
});

test("Vehicle schema enforces one active vehicle per assigned driver", () => {
  const driverIndex = Vehicle.schema.indexes().find(([, options]) =>
    options.name === "unique_active_vehicle_driver"
  );
  assert.ok(driverIndex);
  assert.deepEqual(driverIndex[0], { driver: 1 });
  assert.equal(driverIndex[1].unique, true);
  assert.deepEqual(driverIndex[1].partialFilterExpression, {
    driver: { $type: "objectId" },
    isActive: true
  });
});
