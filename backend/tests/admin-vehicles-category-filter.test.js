import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Vehicle from "../src/models/Vehicle.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import { getAdminVehicles, updateAdminVehicle } from "../src/controllers/vehicleController.js";
import { SERVICE_CATEGORIES } from "../src/utils/vehicleCategories.js";

const mockRes = () => {
  let statusCode = 200;
  let resData = null;
  return {
    res: {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        resData = payload;
        return this;
      }
    },
    getStatusCode: () => statusCode,
    getData: () => resData
  };
};

test("getAdminVehicles filters by serviceCategory=TRUCK including legacy null", async () => {
  const originalFind = Vehicle.find;
  const originalCount = Vehicle.countDocuments;
  let capturedFilter = null;

  try {
    Vehicle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() {
          return {
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                vehicleNumber: "KA01AB1234",
                vehicleType: "mini-truck",
                serviceCategory: "TRUCK"
              }
            ]
          };
        }
      };
    };
    Vehicle.countDocuments = async () => 1;

    const { res, getStatusCode, getData } = mockRes();
    await getAdminVehicles({ query: { serviceCategory: "TRUCK" } }, res);

    assert.equal(getStatusCode(), 200);
    assert.deepEqual(capturedFilter.serviceCategory, { $in: ["TRUCK", null] });
    assert.equal(getData().data.vehicles.length, 1);
  } finally {
    Vehicle.find = originalFind;
    Vehicle.countDocuments = originalCount;
  }
});

test("getAdminVehicles filters by serviceCategory=EV_GOODS", async () => {
  const originalFind = Vehicle.find;
  const originalCount = Vehicle.countDocuments;
  let capturedFilter = null;

  try {
    Vehicle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() {
          return {
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                vehicleNumber: "DL01EV9999",
                vehicleType: "electric-cargo-loader",
                serviceCategory: "EV_GOODS",
                fuelType: "electric"
              }
            ]
          };
        }
      };
    };
    Vehicle.countDocuments = async () => 1;

    const { res, getStatusCode, getData } = mockRes();
    await getAdminVehicles({ query: { serviceCategory: "EV_GOODS" } }, res);

    assert.equal(getStatusCode(), 200);
    assert.equal(capturedFilter.serviceCategory, "EV_GOODS");
    assert.equal(getData().data.vehicles[0].vehicleType, "electric-cargo-loader");
  } finally {
    Vehicle.find = originalFind;
    Vehicle.countDocuments = originalCount;
  }
});

test("getAdminVehicles filters by serviceCategory=GOODS_TAXI", async () => {
  const originalFind = Vehicle.find;
  const originalCount = Vehicle.countDocuments;
  let capturedFilter = null;

  try {
    Vehicle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() {
          return {
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                vehicleNumber: "MH04GT5555",
                vehicleType: "tata-ace",
                serviceCategory: "GOODS_TAXI",
                fuelType: "cng"
              }
            ]
          };
        }
      };
    };
    Vehicle.countDocuments = async () => 1;

    const { res, getStatusCode, getData } = mockRes();
    await getAdminVehicles({ query: { serviceCategory: "GOODS_TAXI" } }, res);

    assert.equal(getStatusCode(), 200);
    assert.equal(capturedFilter.serviceCategory, "GOODS_TAXI");
    assert.equal(getData().data.vehicles[0].vehicleType, "tata-ace");
  } finally {
    Vehicle.find = originalFind;
    Vehicle.countDocuments = originalCount;
  }
});

test("getAdminVehicles filters by specific vehicle subcategory", async () => {
  const originalFind = Vehicle.find;
  const originalCount = Vehicle.countDocuments;
  let capturedFilter = null;

  try {
    Vehicle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() {
          return {
            lean: async () => []
          };
        }
      };
    };
    Vehicle.countDocuments = async () => 0;

    const { res, getStatusCode } = mockRes();
    await getAdminVehicles({ query: { vehicleType: "tata-ace" } }, res);

    assert.equal(getStatusCode(), 200);
    assert.equal(capturedFilter.vehicleType, "tata-ace");
  } finally {
    Vehicle.find = originalFind;
    Vehicle.countDocuments = originalCount;
  }
});

test("getAdminVehicles validates invalid category and subcategory queries", async () => {
  const { res: res1, getStatusCode: code1, getData: data1 } = mockRes();
  await getAdminVehicles({ query: { serviceCategory: "AIRPLANE" } }, res1);
  assert.equal(code1(), 400);
  assert.match(data1().message, /Invalid service category/);

  const { res: res2, getStatusCode: code2, getData: data2 } = mockRes();
  await getAdminVehicles({ query: { vehicleType: "rocket" } }, res2);
  assert.equal(code2(), 400);
  assert.match(data2().message, /Invalid vehicle type/);
});

test("getAdminVehicles combines search, category, status, and pagination", async () => {
  const originalFind = Vehicle.find;
  const originalCount = Vehicle.countDocuments;
  const originalDriverFind = Driver.find;
  const originalAgencyFind = Agency.find;
  let capturedFilter = null;

  try {
    Driver.find = () => ({ select: () => ({ lean: async () => [] }) });
    Agency.find = () => ({ select: () => ({ lean: async () => [] }) });

    Vehicle.find = (filter) => {
      capturedFilter = filter;
      return {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() {
          return {
            lean: async () => []
          };
        }
      };
    };
    Vehicle.countDocuments = async () => 0;

    const { res, getStatusCode } = mockRes();
    await getAdminVehicles({
      query: {
        search: "EV",
        serviceCategory: "EV_GOODS",
        vehicleType: "electric-cargo-loader",
        status: "active",
        page: "2",
        limit: "10"
      }
    }, res);

    assert.equal(getStatusCode(), 200);
    assert.ok(capturedFilter.$or);
    assert.equal(capturedFilter.serviceCategory, "EV_GOODS");
    assert.equal(capturedFilter.vehicleType, "electric-cargo-loader");
    assert.equal(capturedFilter.isActive, true);
  } finally {
    Vehicle.find = originalFind;
    Vehicle.countDocuments = originalCount;
    Driver.find = originalDriverFind;
    Agency.find = originalAgencyFind;
  }
});

test("updateAdminVehicle successfully updates serviceCategory and vehicleType", async () => {
  const originalFindByIdAndUpdate = Vehicle.findByIdAndUpdate;
  try {
    let capturedUpdates = null;
    const testId = new mongoose.Types.ObjectId();

    Vehicle.findByIdAndUpdate = async (id, updateDoc) => {
      capturedUpdates = updateDoc.$set;
      return {
        _id: id,
        vehicleNumber: "KA01EV1111",
        vehicleMake: "Mahindra",
        vehicleModel: "Zor Grand",
        serviceCategory: capturedUpdates.serviceCategory,
        vehicleType: capturedUpdates.vehicleType,
        fuelType: capturedUpdates.fuelType,
        batteryRangeKm: capturedUpdates.batteryRangeKm,
        loadCapacity: { value: 1000, unit: "kg" },
        bodyType: "closed",
        isActive: true,
        toObject() { return this; }
      };
    };

    const { res, getStatusCode, getData } = mockRes();
    await updateAdminVehicle({
      params: { id: testId.toString() },
      body: {
        vehicleNumber: "KA01EV1111",
        vehicleMake: "Mahindra",
        vehicleModel: "Zor Grand",
        serviceCategory: "EV_GOODS",
        vehicleType: "electric-cargo-loader",
        fuelType: "electric",
        batteryRangeKm: 150,
        chargingInformation: "Standard 15A Socket",
        serviceAreas: ["Bangalore Central"],
        loadCapacity: { value: 1000, unit: "kg" },
        bodyType: "closed"
      }
    }, res);

    assert.equal(getStatusCode(), 200);
    assert.equal(capturedUpdates.serviceCategory, "EV_GOODS");
    assert.equal(capturedUpdates.vehicleType, "electric-cargo-loader");
    assert.equal(capturedUpdates.fuelType, "electric");
    assert.equal(capturedUpdates.batteryRangeKm, 150);
  } finally {
    Vehicle.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
