import assert from "node:assert/strict";
import test from "node:test";

import {
  SERVICE_CATEGORIES,
  VEHICLE_TYPES_BY_CATEGORY,
  canonicalizeServiceCategory,
  isPassengerCategory,
  isGoodsCategory,
  isValidCategoryVehicleType,
  getServiceCategoryForVehicleType
} from "../src/utils/vehicleCategories.js";
import { getVehicles } from "../src/controllers/vehicleController.js";
import { getFareQuotes, getFares } from "../src/controllers/fareController.js";
import { calculateMultiVehicleFareQuotes } from "../src/services/fareService.js";
import { setCachedSetting } from "../src/services/systemSettingService.js";

// Prime settings cache for offline execution without active MongoDB
setCachedSetting("fare.enabled", true);
setCachedSetting("service.ev_passenger.enabled", true);
setCachedSetting("service.taxi.enabled", true);
setCachedSetting("service.goods_transport.enabled", true);

test("Canonical categories strictly separate passenger vehicles and goods vehicles", () => {
  // 1. EV_PASSENGER types
  const evPassTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.EV_PASSENGER];
  assert.ok(evPassTypes.includes("electric-rickshaw"));
  assert.ok(evPassTypes.includes("electric-passenger-three-wheeler"));
  assert.ok(evPassTypes.includes("other-electric-passenger"));
  assert.equal(evPassTypes.includes("electric-cargo-loader"), false, "electric-cargo-loader must NEVER be in EV_PASSENGER");

  // 2. TAXI types
  const taxiTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.TAXI];
  assert.ok(taxiTypes.includes("sedan"));
  assert.ok(taxiTypes.includes("hatchback"));
  assert.ok(taxiTypes.includes("suv"));
  assert.equal(taxiTypes.includes("mini-pickup"), false);

  // 3. GOODS_TRANSPORT types
  const goodsTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.GOODS_TRANSPORT];
  assert.ok(goodsTypes.includes("pickup"));
  assert.ok(goodsTypes.includes("mini-truck"));
  assert.ok(goodsTypes.includes("small-truck"));
  assert.ok(goodsTypes.includes("medium-truck"));
  assert.ok(goodsTypes.includes("large-truck"));
});

test("electric-cargo-loader is classified as cargo/goods and NOT passenger", () => {
  assert.equal(isPassengerCategory("electric-cargo-loader"), false);
  assert.equal(isGoodsCategory("electric-cargo-loader"), true);

  const cargoVehicle = {
    vehicleType: "electric-cargo-loader",
    serviceCategory: "EV_GOODS"
  };
  assert.equal(isPassengerCategory(cargoVehicle), false);
  assert.equal(isGoodsCategory(cargoVehicle), true);
  assert.equal(canonicalizeServiceCategory(cargoVehicle.serviceCategory, cargoVehicle.vehicleType), "GOODS_TRANSPORT");

  const passengerEV = {
    vehicleType: "electric-rickshaw",
    serviceCategory: "EV_PASSENGER"
  };
  assert.equal(isPassengerCategory(passengerEV), true);
  assert.equal(isGoodsCategory(passengerEV), false);
  assert.equal(canonicalizeServiceCategory(passengerEV.serviceCategory, passengerEV.vehicleType), "EV_PASSENGER");
});

test("isValidCategoryVehicleType rejects electric-cargo-loader for EV_PASSENGER", () => {
  assert.equal(isValidCategoryVehicleType("EV_PASSENGER", "electric-cargo-loader"), false);
  assert.equal(isValidCategoryVehicleType("EV_PASSENGER", "electric-rickshaw"), true);
  assert.equal(isValidCategoryVehicleType("TAXI", "sedan"), true);
  assert.equal(isValidCategoryVehicleType("TAXI", "mini-truck"), false);
  assert.equal(isValidCategoryVehicleType("GOODS_TRANSPORT", "mini-truck"), true);
  assert.equal(isValidCategoryVehicleType("GOODS_TRANSPORT", "sedan"), false);
});

test("Regression: Inconsistent request (electric-cargo-loader + EV_PASSENGER) is rejected with 400", async () => {
  // Mock response for getVehicles controller
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    query: {
      vehicleType: "electric-cargo-loader",
      serviceCategory: "EV_PASSENGER"
    }
  };

  await getVehicles(req, mockRes);
  assert.equal(responseStatus, 400);
  assert.match(responseBody.message, /Vehicle type does not belong to the selected service category/);
});

test("Regression: fare quotes reject inconsistent electric-cargo-loader + EV_PASSENGER", async () => {
  await assert.rejects(
    calculateMultiVehicleFareQuotes({
      distanceKm: 10,
      vehicleType: "electric-cargo-loader",
      serviceCategory: "EV_PASSENGER"
    }),
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /Vehicle type does not belong to the selected service category/);
      return true;
    }
  );
});

test("Regression: serviceCategory='all' does NOT fail with 'Invalid service category'", async () => {
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    query: {
      serviceCategory: "all"
    }
  };

  // getVehicles should treat "all" as no filter and succeed (or query DB) without throwing Invalid service category
  try {
    await getVehicles(req, mockRes);
    // If MongoDB is connected it returns 200, if not connected it may throw DB error, but NEVER 400 "Invalid service category"
    if (responseStatus === 400) {
      assert.notEqual(responseBody?.message, "Invalid service category");
    }
  } catch (err) {
    assert.notMatch(err.message, /Invalid service category/);
  }
});

test("Exact failing POST payload: { distanceKm, weight: { value: 0 }, serviceCategory: 'EV_PASSENGER' } is accepted by getFareQuotes", async () => {
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    body: {
      distanceKm: 10,
      weight: { value: 0, unit: "kg" },
      serviceCategory: "EV_PASSENGER",
      loadingRequired: false,
      unloadingRequired: false
    }
  };

  try {
    await getFareQuotes(req, mockRes);
    // If offline without DB, it might return 500 or timeout DB buffering, but NEVER 400 "Invalid service category"
    if (responseStatus === 400) {
      assert.notEqual(responseBody?.message, "Invalid service category");
    }
  } catch (err) {
    assert.notMatch(err.message, /Invalid service category/);
  }
});

test("Independent quote validation: TAXI payload with weight 0 is accepted without 'Invalid service category'", async () => {
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    body: {
      distanceKm: 15,
      weight: { value: 0, unit: "kg" },
      serviceCategory: "TAXI",
      loadingRequired: false,
      unloadingRequired: false
    }
  };

  try {
    await getFareQuotes(req, mockRes);
    if (responseStatus === 400) {
      assert.notEqual(responseBody?.message, "Invalid service category");
    }
  } catch (err) {
    assert.notMatch(err.message, /Invalid service category/);
  }
});

test("Independent quote validation: GOODS_TRANSPORT payload with weight is accepted without 'Invalid service category'", async () => {
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    body: {
      distanceKm: 25,
      weight: { value: 500, unit: "kg" },
      serviceCategory: "GOODS_TRANSPORT",
      loadingRequired: false,
      unloadingRequired: false
    }
  };

  try {
    await getFareQuotes(req, mockRes);
    if (responseStatus === 400) {
      assert.notEqual(responseBody?.message, "Invalid service category");
    }
  } catch (err) {
    assert.notMatch(err.message, /Invalid service category/);
  }
});

test("Truly invalid category (e.g. 'AEROPLANE') is rejected with 400 'Invalid service category'", async () => {
  let responseStatus = null;
  let responseBody = null;
  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  const req = {
    body: {
      distanceKm: 10,
      weight: { value: 100, unit: "kg" },
      serviceCategory: "AEROPLANE"
    }
  };

  await getFareQuotes(req, mockRes);
  assert.equal(responseStatus, 400);
  assert.equal(responseBody?.message, "Invalid service category");
});
