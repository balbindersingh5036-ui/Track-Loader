import test from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  isEVVehicle,
  getVehicleCategoryLabel,
  resolveVehicleServiceCategory,
  getServiceCategoryForVehicleType,
  formatVehicleCategory,
  getCleanVehicleDisplayName
} from "../src/utils/vehicleDisplay.js";

test("EV_GOODS vehicle identification and display labels", () => {
  const evVehicle = {
    _id: "veh_ev_1",
    serviceCategory: "EV_GOODS",
    vehicleType: "electric-cargo-loader",
    vehicleModel: "Electric Cargo Loader 120"
  };

  assert.equal(isEVVehicle(evVehicle), true, "Should identify EV_GOODS as EV vehicle");
  assert.equal(
    getVehicleCategoryLabel(evVehicle),
    "EV Goods",
    "Should display EV Goods as category label"
  );
  assert.notEqual(
    getVehicleCategoryLabel(evVehicle),
    "Truck",
    "Must NOT display Truck for EV_GOODS"
  );
  assert.notEqual(
    getVehicleCategoryLabel(evVehicle),
    "Large Truck",
    "Must NOT display Large Truck for EV_GOODS"
  );
  assert.equal(resolveVehicleServiceCategory(evVehicle), SERVICE_CATEGORIES.EV_GOODS);
});

test("TRUCK vehicle identification and display labels", () => {
  const truckVehicle = {
    _id: "veh_truck_1",
    serviceCategory: "TRUCK",
    vehicleType: "large-truck",
    vehicleModel: "BharatBenz 1617R"
  };

  assert.equal(isEVVehicle(truckVehicle), false, "Standard truck must NOT be identified as EV");
  assert.equal(getVehicleCategoryLabel(truckVehicle), "Truck");
  assert.equal(getVehicleCategoryLabel(truckVehicle, { plural: true }), "Trucks");
  assert.equal(resolveVehicleServiceCategory(truckVehicle), SERVICE_CATEGORIES.TRUCK);
});

test("GOODS_TAXI vehicle identification and display labels", () => {
  const taxiVehicle = {
    _id: "veh_taxi_1",
    serviceCategory: "GOODS_TAXI",
    vehicleType: "tata-ace",
    vehicleModel: "Tata Ace Gold"
  };

  assert.equal(isEVVehicle(taxiVehicle), false, "Goods taxi must NOT be identified as EV");
  assert.equal(getVehicleCategoryLabel(taxiVehicle), "Goods Taxi");
  assert.notEqual(getVehicleCategoryLabel(taxiVehicle), "Truck");
  assert.equal(resolveVehicleServiceCategory(taxiVehicle), SERVICE_CATEGORIES.GOODS_TAXI);
});

test("Does NOT identify vehicles as EV only by their names", () => {
  const namedEvTruck = {
    _id: "veh_named_ev",
    serviceCategory: "TRUCK",
    vehicleType: "large-truck",
    vehicleModel: "Tata Ace EV Power Edition"
  };

  assert.equal(
    isEVVehicle(namedEvTruck),
    false,
    "Vehicle with 'EV' in name but serviceCategory TRUCK must NOT have EV badge"
  );
  assert.equal(getVehicleCategoryLabel(namedEvTruck), "Truck");

  const namedElectricTaxi = {
    _id: "veh_named_taxi",
    serviceCategory: "GOODS_TAXI",
    vehicleType: "goods-loading-taxi",
    vehicleModel: "Electric Green Cargo Taxi"
  };

  assert.equal(
    isEVVehicle(namedElectricTaxi),
    false,
    "Taxi with 'Electric' in name but serviceCategory GOODS_TAXI must NOT have EV badge"
  );
  assert.equal(getVehicleCategoryLabel(namedElectricTaxi), "Goods Taxi");
});

test("Fallback category resolution by vehicleType when serviceCategory is missing", () => {
  const legacyEv = {
    vehicleType: "electric-cargo-loader",
    vehicleModel: "Loader 500"
  };
  assert.equal(isEVVehicle(legacyEv), true);
  assert.equal(getVehicleCategoryLabel(legacyEv), "EV Goods");

  const legacyTruck = {
    vehicleType: "mini-truck",
    vehicleModel: "Bolo"
  };
  assert.equal(isEVVehicle(legacyTruck), false);
  assert.equal(getVehicleCategoryLabel(legacyTruck), "Truck");

  const legacyTaxi = {
    vehicleType: "tata-ace",
    vehicleModel: "Chota Hathi"
  };
  assert.equal(isEVVehicle(legacyTaxi), false);
  assert.equal(getVehicleCategoryLabel(legacyTaxi), "Goods Taxi");
});

test("Nested vehicle in booking record correctly resolved", () => {
  const bookingWithPopulatedEv = {
    bookingId: "LB-EV-9999",
    bookingStatus: "in-progress",
    vehicle: {
      serviceCategory: "EV_GOODS",
      vehicleType: "electric-cargo-loader",
      vehicleModel: "Electric Cargo Loader"
    }
  };

  assert.equal(isEVVehicle(bookingWithPopulatedEv), true);
  assert.equal(getVehicleCategoryLabel(bookingWithPopulatedEv), "EV Goods");

  const bookingWithFlatEv = {
    bookingId: "LB-EV-8888",
    serviceCategory: "EV_GOODS",
    vehicleType: "electric-goods-e-rickshaw"
  };

  assert.equal(isEVVehicle(bookingWithFlatEv), true);
  assert.equal(getVehicleCategoryLabel(bookingWithFlatEv), "EV Goods");
});
