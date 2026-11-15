import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Vehicle from "../src/models/Vehicle.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import Booking from "../src/models/Booking.js";
import User from "../src/models/User.js";
import SystemSetting from "../src/models/SystemSetting.js";
import {
  reviewAdminVehicleDocument,
  updateAdminVehicleStatus
} from "../src/controllers/vehicleController.js";
import {
  updateAgencyVehicle,
  assignVehicleDriver
} from "../src/controllers/agencyController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { SERVICE_CATEGORIES } from "../src/utils/vehicleCategories.js";

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

test("EV_GOODS workflow: document review, activation gating, and preservation of category & type", async (t) => {
  const vehicleId = new mongoose.Types.ObjectId();
  const superAdminId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();

  const vehicleDoc = {
    _id: vehicleId,
    vehicleNumber: "EV01AA1234",
    vehicleModel: "Electric Loader X1",
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    vehicleType: "electric-cargo-loader",
    fuelType: "electric",
    loadCapacity: { value: 120, unit: "kg" },
    batteryRangeKm: 120,
    chargingInformation: "Type 2 AC fast charging",
    isActive: false,
    isAvailable: true,
    agency: agencyId,
    driver: null,
    documents: {
      registration: {
        publicId: "loadbalbin_kyc/ev_rc",
        url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/ev_rc.pdf",
        status: "pending",
        reviewHistory: []
      },
      insurance: {
        publicId: "loadbalbin_kyc/ev_ins",
        url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/ev_ins.pdf",
        status: "pending",
        reviewHistory: []
      }
    },
    markModified() {},
    async save() { return this; }
  };

  t.mock.method(Vehicle, "findById", async (id) => {
    if (String(id) === String(vehicleId)) return vehicleDoc;
    return null;
  });
  t.mock.method(Booking, "exists", async () => null);
  t.mock.method(Agency, "findById", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));

  // Step 1: Admin attempts to activate while documents are pending -> BLOCKED with 409
  const res1 = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, res1);

  assert.equal(res1.statusCode, 409);
  assert.equal(res1.body.message, "RC and Insurance must both be approved before vehicle activation");
  assert.equal(vehicleDoc.isActive, false);

  // Step 2: Super Admin approves RC
  const res2 = createResponse();
  await reviewAdminVehicleDocument({
    params: { id: vehicleId.toString(), docType: "registration", action: "approve" },
    body: {},
    user: { _id: superAdminId, role: "admin" }
  }, res2);

  assert.equal(res2.statusCode, 200);
  assert.equal(vehicleDoc.documents.registration.status, "approved");
  assert.equal(vehicleDoc.documents.insurance.status, "pending");

  // Step 3: Admin attempts activation when only RC is approved (Insurance still pending) -> BLOCKED with 409
  const res3 = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, res3);

  assert.equal(res3.statusCode, 409);
  assert.equal(res3.body.message, "RC and Insurance must both be approved before vehicle activation");
  assert.equal(vehicleDoc.isActive, false);

  // Step 4: Super Admin approves Insurance
  const res4 = createResponse();
  await reviewAdminVehicleDocument({
    params: { id: vehicleId.toString(), docType: "insurance", action: "approve" },
    body: {},
    user: { _id: superAdminId, role: "admin" }
  }, res4);

  assert.equal(res4.statusCode, 200);
  assert.equal(vehicleDoc.documents.insurance.status, "approved");

  // Step 5: Admin activates the vehicle after both documents are approved -> SUCCESS 200
  const res5 = createResponse();
  await updateAdminVehicleStatus({
    params: { id: vehicleId.toString() },
    body: { isActive: true }
  }, res5);

  assert.equal(res5.statusCode, 200);
  assert.equal(vehicleDoc.isActive, true);
  // Verify category and type are strictly preserved
  assert.equal(vehicleDoc.serviceCategory, SERVICE_CATEGORIES.EV_GOODS);
  assert.equal(vehicleDoc.vehicleType, "electric-cargo-loader");
  assert.equal(vehicleDoc.loadCapacity.value, 120);
});

test("Agency permissions: cannot activate inactive EV_GOODS vehicle, can edit active vehicle", async (t) => {
  const agencyUserId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();

  const vehicleDoc = {
    _id: vehicleId,
    vehicleNumber: "EV02BB5678",
    vehicleModel: "Eco Carrier 100",
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    vehicleType: "electric-cargo-loader",
    fuelType: "electric",
    loadCapacity: { value: 120, unit: "kg" },
    isActive: false,
    agency: agencyId,
    driver: null,
    vehicleImages: [],
    markModified() {},
    async save() { return this; }
  };

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: agencyUserId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "findOne", async () => vehicleDoc);
  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.ev_goods.enabled") return { key, value: true, isActive: true };
    if (key === "service.ev_goods.allowed_vehicle_types") return { key, value: ["electric-cargo-loader"], isActive: true };
    return null;
  });
  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");

  // 1. Agency attempts to activate inactive EV_GOODS vehicle -> 403 Forbidden
  const res1 = createResponse();
  await updateAgencyVehicle({
    user: { _id: agencyUserId, role: "agency" },
    params: { id: vehicleId.toString() },
    body: {
      vehicleModel: "Eco Carrier 100 Updated",
      vehicleType: "electric-cargo-loader",
      isActive: true
    }
  }, res1);

  assert.equal(res1.statusCode, 403);
  assert.equal(res1.body.message, "Only an administrator can approve and activate a goods vehicle");
  assert.equal(vehicleDoc.isActive, false);

  // 2. Now simulate vehicle was activated by Admin
  vehicleDoc.isActive = true;

  // 3. Agency updates vehicle details (model, capacity) on active vehicle with isActive: true -> SUCCEEDS 200
  const res2 = createResponse();
  await updateAgencyVehicle({
    user: { _id: agencyUserId, role: "agency" },
    params: { id: vehicleId.toString() },
    body: {
      vehicleModel: "Eco Carrier 100 Pro",
      vehicleType: "electric-cargo-loader",
      isActive: true
    }
  }, res2);

  assert.equal(res2.statusCode, 200);
  assert.equal(vehicleDoc.vehicleModel, "Eco Carrier 100 Pro");
  assert.equal(vehicleDoc.isActive, true);
});

test("Driver assignment: Agency cannot assign driver to inactive vehicle, can assign once activated", async (t) => {
  const agencyUserId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();

  const vehicleDoc = {
    _id: vehicleId,
    vehicleNumber: "EV03CC9012",
    vehicleModel: "Electric Loader",
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    vehicleType: "electric-cargo-loader",
    isActive: false, // Inactive
    isAvailable: true,
    agency: agencyId,
    driver: null,
    async save() { return this; }
  };

  const driverDoc = {
    _id: driverId,
    user: { _id: driverUserId, role: "driver" },
    fullName: "Ramesh Kumar",
    phone: "+919876543210",
    agency: agencyId,
    approvalStatus: "approved",
    isActive: true,
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: agencyUserId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "findOne", async (query) => {
    if (query && query.driver) return null; // no conflicting vehicle
    return vehicleDoc;
  });
  t.mock.method(Driver, "findOne", async () => driverDoc);

  // Step 1: Assign to inactive vehicle -> REJECTED (Vehicle must be active)
  const res1 = createResponse();
  await assignVehicleDriver({
    user: { _id: agencyUserId, role: "agency" },
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() }
  }, res1);

  assert.equal(res1.statusCode, 403);
  assert.equal(res1.body.message, "Vehicle must be active before assigning a driver");
  assert.equal(vehicleDoc.driver, null);

  // Step 2: Vehicle is activated by Admin
  vehicleDoc.isActive = true;

  // Step 3: Assign driver to active vehicle -> SUCCESS
  const res2 = createResponse();
  await assignVehicleDriver({
    user: { _id: agencyUserId, role: "agency" },
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() }
  }, res2);

  assert.equal(res2.statusCode, 200);
  assert.equal(String(vehicleDoc.driver), String(driverId));
});

test("GOODS_TAXI & TRUCK workflows: document approval and activation behave consistently", async (t) => {
  const superAdminId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();

  for (const category of [SERVICE_CATEGORIES.TRUCK, SERVICE_CATEGORIES.GOODS_TAXI]) {
    const vId = new mongoose.Types.ObjectId();
    const vDoc = {
      _id: vId,
      vehicleNumber: category === SERVICE_CATEGORIES.TRUCK ? "TR01AA1111" : "GT01AA2222",
      vehicleModel: category === SERVICE_CATEGORIES.TRUCK ? "Tata 407" : "Tata Ace Gold",
      serviceCategory: category,
      vehicleType: category === SERVICE_CATEGORIES.TRUCK ? "small-truck" : "tata-ace",
      fuelType: "diesel",
      loadCapacity: { value: 1000, unit: "kg" },
      isActive: false,
      isAvailable: true,
      agency: agencyId,
      driver: null,
      documents: {
        registration: {
          publicId: `loadbalbin_kyc/${category}_rc`,
          url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/rc.pdf",
          status: "pending",
          reviewHistory: []
        },
        insurance: {
          publicId: `loadbalbin_kyc/${category}_ins`,
          url: "https://res.cloudinary.com/test/image/upload/loadbalbin_kyc/ins.pdf",
          status: "pending",
          reviewHistory: []
        }
      },
      markModified() {},
      async save() { return this; }
    };

    t.mock.method(Vehicle, "findById", async () => vDoc);
    t.mock.method(Booking, "exists", async () => null);
    t.mock.method(Agency, "findById", async () => ({
      _id: agencyId,
      approvalStatus: "approved",
      isActive: true
    }));

    // Inactive + pending docs -> Activation rejected 409
    const resA = createResponse();
    await updateAdminVehicleStatus({
      params: { id: vId.toString() },
      body: { isActive: true }
    }, resA);
    assert.equal(resA.statusCode, 409);

    // Approve RC
    const resB = createResponse();
    await reviewAdminVehicleDocument({
      params: { id: vId.toString(), docType: "registration", action: "approve" },
      body: {},
      user: { _id: superAdminId, role: "admin" }
    }, resB);
    assert.equal(resB.statusCode, 200);

    // Approve Insurance
    const resC = createResponse();
    await reviewAdminVehicleDocument({
      params: { id: vId.toString(), docType: "insurance", action: "approve" },
      body: {},
      user: { _id: superAdminId, role: "admin" }
    }, resC);
    assert.equal(resC.statusCode, 200);

    // Activate
    const resD = createResponse();
    await updateAdminVehicleStatus({
      params: { id: vId.toString() },
      body: { isActive: true }
    }, resD);
    assert.equal(resD.statusCode, 200);
    assert.equal(vDoc.isActive, true);
    assert.equal(vDoc.serviceCategory, category);
  }
});

test("Security check: superAdminOnly blocks non-designated admin and agency accounts from review", async (t) => {
  const { superAdminOnly } = await import("../src/middleware/superAdminMiddleware.js");

  const ordinaryAdmin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
  const agencyUser = { _id: new mongoose.Types.ObjectId(), role: "agency" };

  const res1 = createResponse();
  let nextCalled1 = false;
  superAdminOnly({ user: ordinaryAdmin }, res1, () => { nextCalled1 = true; });
  assert.equal(nextCalled1, false);
  assert.ok([403, 503].includes(res1.statusCode));

  const res2 = createResponse();
  let nextCalled2 = false;
  superAdminOnly({ user: agencyUser }, res2, () => { nextCalled2 = true; });
  assert.equal(nextCalled2, false);
  assert.ok([403, 503].includes(res2.statusCode));
});
