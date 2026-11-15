import assert from "node:assert/strict";
import test from "node:test";

import Vehicle from "../src/models/Vehicle.js";
import {
  getCategoryEnabledSettingKey,
  getServiceCategoryForVehicleType,
  SERVICE_CATEGORIES,
  VEHICLE_TYPES_BY_CATEGORY
} from "../src/utils/vehicleCategories.js";

test("goods vehicle types are scoped to stable service category identifiers", () => {
  assert.equal(getServiceCategoryForVehicleType("electric-cargo-loader"), "EV_GOODS");
  assert.equal(getServiceCategoryForVehicleType("goods-loading-taxi"), "GOODS_TAXI");
  assert.equal(getServiceCategoryForVehicleType("mini-truck"), "TRUCK");
  assert.equal(getServiceCategoryForVehicleType("passenger-car"), null);
  assert.equal(getCategoryEnabledSettingKey(SERVICE_CATEGORIES.EV_GOODS), "service.ev_goods.enabled");
  assert.equal(getCategoryEnabledSettingKey(SERVICE_CATEGORIES.GOODS_TAXI), "service.goods_taxi.enabled");
  assert.equal(VEHICLE_TYPES_BY_CATEGORY.EV_GOODS.includes("mini-truck"), false);
  assert.equal(VEHICLE_TYPES_BY_CATEGORY.GOODS_TAXI.includes("sedan"), false);
});

test("EV Goods vehicles require electric fuel and matching vehicle type", async () => {
  const electricVehicle = new Vehicle({
    vehicleNumber: "EV-100",
    vehicleModel: "Electric Cargo Loader",
    vehicleType: "electric-cargo-loader",
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    fuelType: "electric",
    batteryRangeKm: 100,
    chargingInformation: "AC charging",
    loadCapacity: { value: 500, unit: "kg" }
  });
  await electricVehicle.validate();

  const petrolVehicle = new Vehicle({
    vehicleNumber: "EV-101",
    vehicleModel: "Petrol Cargo Loader",
    vehicleType: "electric-cargo-loader",
    serviceCategory: SERVICE_CATEGORIES.EV_GOODS,
    fuelType: "petrol",
    batteryRangeKm: 100,
    chargingInformation: "AC charging",
    loadCapacity: { value: 500, unit: "kg" }
  });
  await assert.rejects(petrolVehicle.validate(), /EV Goods vehicles must use electric power/);

  const passengerVehicle = new Vehicle({
    vehicleNumber: "GT-100",
    vehicleModel: "Passenger Sedan",
    vehicleType: "sedan",
    serviceCategory: SERVICE_CATEGORIES.GOODS_TAXI,
    fuelType: "petrol",
    loadCapacity: { value: 500, unit: "kg" }
  });
  await assert.rejects(passengerVehicle.validate());
});
