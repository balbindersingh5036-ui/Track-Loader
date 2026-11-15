import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Vehicle from "../src/models/Vehicle.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import SystemSetting from "../src/models/SystemSetting.js";
import { createAgencyVehicle } from "../src/controllers/agencyController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { SERVICE_CATEGORIES } from "../src/utils/vehicleCategories.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});

test("TRUCK category: standard truck subcategory can be registered by an authorized agency", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  let createdVehicle = null;
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicle = data;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      isAvailable: true,
      isActive: true
    };
  });

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "PB10XY1234",
      vehicleMake: "Tata",
      vehicleModel: "Tata 407",
      vehicleType: "mini-truck",
      serviceCategory: SERVICE_CATEGORIES.TRUCK,
      loadCapacity: { value: 1500, unit: "kg" },
      bodyType: "open"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(createdVehicle.vehicleNumber, "PB10XY1234");
  assert.equal(createdVehicle.vehicleType, "mini-truck");
  assert.equal(createdVehicle.serviceCategory, "TRUCK");
});

test("EV_GOODS category: rejected with clear category disabled error when disabled by Admin", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.ev_goods.enabled") {
      return { key, value: false, isActive: true };
    }
    return null;
  });

  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "DL01EV1001",
      vehicleMake: "Mahindra",
      vehicleModel: "Mahindra Zor Grand",
      vehicleType: "electric-cargo-loader",
      serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
      fuelType: "electric",
      batteryRangeKm: 120,
      chargingInformation: "Type 2 Fast Charge",
      loadCapacity: { value: 500, unit: "kg" },
      bodyType: "closed"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /This goods vehicle category is not enabled by the administrator/i);

  clearCache("service.ev_goods.enabled");
});

test("EV_GOODS category: allows enabled vehicle type when EV Goods service is enabled", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.ev_goods.enabled") {
      return { key, value: true, isActive: true };
    }
    if (key === "service.ev_goods.allowed_vehicle_types") {
      return {
        key,
        value: ["electric-cargo-loader", "electric-goods-e-rickshaw", "electric-mini-cargo-carrier"],
        isActive: true
      };
    }
    return null;
  });

  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");

  let createdVehicle = null;
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicle = data;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      isAvailable: true,
      isActive: false
    };
  });

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "DL01EV1002",
      vehicleMake: "Mahindra",
      vehicleModel: "Mahindra Zor Grand",
      vehicleType: "electric-cargo-loader",
      serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
      fuelType: "electric",
      batteryRangeKm: 120,
      chargingInformation: "Type 2 Fast Charge",
      loadCapacity: { value: 500, unit: "kg" },
      bodyType: "closed"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(createdVehicle.vehicleNumber, "DL01EV1002");
  assert.equal(createdVehicle.vehicleType, "electric-cargo-loader");
  assert.equal(createdVehicle.serviceCategory, "EV_GOODS");

  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");
});

test("EV_GOODS category: blocks vehicle type that is not in the Admin allowed whitelist", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.ev_goods.enabled") {
      return { key, value: true, isActive: true };
    }
    if (key === "service.ev_goods.allowed_vehicle_types") {
      return {
        key,
        value: ["electric-cargo-loader"],
        isActive: true
      };
    }
    return null;
  });

  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "DL01EV1003",
      vehicleMake: "Piaggio",
      vehicleModel: "Piaggio Ape E-City",
      vehicleType: "electric-goods-e-rickshaw",
      serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
      fuelType: "electric",
      batteryRangeKm: 90,
      chargingInformation: "Standard 15A Plug",
      loadCapacity: { value: 400, unit: "kg" },
      bodyType: "open"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /This goods vehicle type is not enabled by the administrator/i);

  clearCache("service.ev_goods.enabled");
  clearCache("service.ev_goods.allowed_vehicle_types");
});

test("GOODS_TAXI category: rejected when Goods Taxi service is disabled by Admin", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.goods_taxi.enabled") {
      return { key, value: false, isActive: true };
    }
    return null;
  });

  clearCache("service.goods_taxi.enabled");

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "MH12GT2001",
      vehicleMake: "Tata",
      vehicleModel: "Tata Ace Gold",
      vehicleType: "tata-ace",
      serviceCategory: SERVICE_CATEGORIES.GOODS_TAXI,
      fuelType: "cng",
      loadCapacity: { value: 750, unit: "kg" },
      bodyType: "closed"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /This goods vehicle category is not enabled by the administrator/i);

  clearCache("service.goods_taxi.enabled");
});

test("GOODS_TAXI category: allows enabled subcategory (tata-ace) when Goods Taxi service is enabled", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.goods_taxi.enabled") {
      return { key, value: true, isActive: true };
    }
    return null;
  });

  clearCache("service.goods_taxi.enabled");
  clearCache("service.goods_taxi.allowed_vehicle_types");

  let createdVehicle = null;
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicle = data;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      isAvailable: true,
      isActive: false
    };
  });

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "MH12GT2002",
      vehicleMake: "Tata",
      vehicleModel: "Tata Ace Gold",
      vehicleType: "tata-ace",
      serviceCategory: SERVICE_CATEGORIES.GOODS_TAXI,
      fuelType: "cng",
      loadCapacity: { value: 750, unit: "kg" },
      bodyType: "closed"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(createdVehicle.vehicleNumber, "MH12GT2002");
  assert.equal(createdVehicle.vehicleType, "tata-ace");
  assert.equal(createdVehicle.serviceCategory, "GOODS_TAXI");

  clearCache("service.goods_taxi.enabled");
  clearCache("service.goods_taxi.allowed_vehicle_types");
});

test("GOODS_TAXI category: blocks unapproved subcategory (other-goods-carrier) from registration", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  t.mock.method(SystemSetting, "findOne", async ({ key }) => {
    if (key === "service.goods_taxi.enabled") {
      return { key, value: true, isActive: true };
    }
    return null;
  });

  clearCache("service.goods_taxi.enabled");
  clearCache("service.goods_taxi.allowed_vehicle_types");

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "MH12GT2003",
      vehicleMake: "Custom",
      vehicleModel: "Custom Goods Carrier",
      vehicleType: "other-goods-carrier",
      serviceCategory: SERVICE_CATEGORIES.GOODS_TAXI,
      fuelType: "diesel",
      loadCapacity: { value: 800, unit: "kg" },
      bodyType: "open"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /This goods vehicle type is not enabled by the administrator/i);

  clearCache("service.goods_taxi.enabled");
  clearCache("service.goods_taxi.allowed_vehicle_types");
});

test("Driver Assignment: vehicle registration validates driver approval and agency ownership", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));

  // Driver belongs to another agency, so not found in caller agency
  t.mock.method(Driver, "findOne", async () => null);

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "PB10DA0001",
      vehicleMake: "Tata",
      vehicleModel: "Tata 407",
      vehicleType: "mini-truck",
      serviceCategory: SERVICE_CATEGORIES.TRUCK,
      loadCapacity: { value: 1500, unit: "kg" },
      bodyType: "open",
      driverId: driverId.toString()
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Driver not found in your agency/i);
});
