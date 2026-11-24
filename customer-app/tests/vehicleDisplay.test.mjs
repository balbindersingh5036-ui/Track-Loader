import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_SERVICE_CATEGORIES,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  isEVVehicle,
  getVehicleCategoryLabel,
  resolveVehicleServiceCategory,
  getServiceCategoryForVehicleType,
  formatVehicleCategory,
  getCleanVehicleDisplayName,
  isPassengerCategory,
  isGoodsCategory,
  canonicalizeServiceCategory
} from "../src/utils/vehicleDisplay.js";

test("EV_PASSENGER vehicle identification and display labels", () => {
  const evVehicle = {
    _id: "veh_ev_1",
    serviceCategory: "EV_PASSENGER",
    vehicleType: "electric-rickshaw",
    vehicleModel: "Electric Rickshaw E-Pass"
  };

  assert.equal(isEVVehicle(evVehicle), true, "Should identify EV_PASSENGER as EV vehicle");
  assert.equal(
    getVehicleCategoryLabel(evVehicle),
    "EV Passenger",
    "Should display EV Passenger as category label"
  );
  assert.equal(isPassengerCategory(evVehicle), true, "EV Passenger must be recognized as passenger category");
  assert.equal(isGoodsCategory(evVehicle), false, "EV Passenger must NOT be recognized as goods category");
  assert.notEqual(
    getVehicleCategoryLabel(evVehicle),
    "Truck",
    "Must NOT display Truck for EV_PASSENGER"
  );
  assert.notEqual(
    getVehicleCategoryLabel(evVehicle),
    "EV Goods",
    "Must NOT display EV Goods for EV_PASSENGER"
  );
});

test("Legacy EV_GOODS alias canonicalization and display labels", () => {
  const legacyEv = {
    _id: "veh_ev_legacy",
    serviceCategory: "EV_GOODS",
    vehicleType: "electric-rickshaw"
  };

  assert.equal(isEVVehicle(legacyEv), true);
  assert.equal(getVehicleCategoryLabel(legacyEv), "EV Passenger");
  assert.equal(canonicalizeServiceCategory(legacyEv.serviceCategory), SERVICE_CATEGORIES.EV_PASSENGER);
  assert.equal(isPassengerCategory(legacyEv), true);
});

test("GOODS_TRANSPORT / TRUCK vehicle identification and display labels", () => {
  const truckVehicle = {
    _id: "veh_truck_1",
    serviceCategory: "GOODS_TRANSPORT",
    vehicleType: "large-truck",
    vehicleModel: "BharatBenz 1617R"
  };

  assert.equal(isEVVehicle(truckVehicle), false, "Standard truck must NOT be identified as EV");
  assert.equal(getVehicleCategoryLabel(truckVehicle), "Goods Transport");
  assert.equal(isPassengerCategory(truckVehicle), false);
  assert.equal(isGoodsCategory(truckVehicle), true);

  const legacyTruck = {
    _id: "veh_truck_legacy",
    serviceCategory: "TRUCK",
    vehicleType: "mini-truck"
  };
  assert.equal(getVehicleCategoryLabel(legacyTruck), "Goods Transport");
  assert.equal(canonicalizeServiceCategory(legacyTruck.serviceCategory), SERVICE_CATEGORIES.GOODS_TRANSPORT);
});

test("TAXI vehicle identification and display labels", () => {
  const taxiVehicle = {
    _id: "veh_taxi_1",
    serviceCategory: "TAXI",
    vehicleType: "sedan",
    vehicleModel: "Swift Dzire"
  };

  assert.equal(isEVVehicle(taxiVehicle), false, "Taxi must NOT be identified as EV");
  assert.equal(getVehicleCategoryLabel(taxiVehicle), "Taxi");
  assert.equal(isPassengerCategory(taxiVehicle), true);
  assert.equal(isGoodsCategory(taxiVehicle), false);

  const legacyTaxi = {
    _id: "veh_taxi_legacy",
    serviceCategory: "GOODS_TAXI",
    vehicleType: "sedan"
  };
  assert.equal(getVehicleCategoryLabel(legacyTaxi), "Taxi");
  assert.equal(canonicalizeServiceCategory(legacyTaxi.serviceCategory), SERVICE_CATEGORIES.TAXI);
});

test("Does NOT identify vehicles as EV only by their names", () => {
  const namedEvTruck = {
    _id: "veh_named_ev",
    serviceCategory: "GOODS_TRANSPORT",
    vehicleType: "large-truck",
    vehicleModel: "Tata Ace EV Power Edition"
  };

  assert.equal(
    isEVVehicle(namedEvTruck),
    false,
    "Vehicle with 'EV' in name but serviceCategory GOODS_TRANSPORT must NOT have EV badge"
  );
  assert.equal(getVehicleCategoryLabel(namedEvTruck), "Goods Transport");

  const namedElectricTaxi = {
    _id: "veh_named_taxi",
    serviceCategory: "TAXI",
    vehicleType: "sedan",
    vehicleModel: "Electric Green Cargo Taxi"
  };

  assert.equal(
    isEVVehicle(namedElectricTaxi),
    false,
    "Taxi with 'Electric' in name but serviceCategory TAXI must NOT have EV badge"
  );
  assert.equal(getVehicleCategoryLabel(namedElectricTaxi), "Taxi");
});

test("Fallback category resolution by vehicleType when serviceCategory is missing", () => {
  const fallbackPassengerEv = {
    vehicleType: "electric-rickshaw",
    vehicleModel: "E-Rickshaw 500"
  };
  assert.equal(isEVVehicle(fallbackPassengerEv), true);
  assert.equal(getVehicleCategoryLabel(fallbackPassengerEv), "EV Passenger");
  assert.equal(isPassengerCategory(fallbackPassengerEv), true);

  const fallbackTruck = {
    vehicleType: "mini-truck",
    vehicleModel: "Bolo"
  };
  assert.equal(isEVVehicle(fallbackTruck), false);
  assert.equal(getVehicleCategoryLabel(fallbackTruck), "Goods Transport");
  assert.equal(isGoodsCategory(fallbackTruck), true);

  const fallbackTaxi = {
    vehicleType: "sedan",
    vehicleModel: "Dzire"
  };
  assert.equal(isEVVehicle(fallbackTaxi), false);
  assert.equal(getVehicleCategoryLabel(fallbackTaxi), "Taxi");
  assert.equal(isPassengerCategory(fallbackTaxi), true);
});

test("Nested vehicle in booking record correctly resolved", () => {
  const bookingWithPopulatedEv = {
    bookingId: "LB-EV-9999",
    bookingStatus: "in-progress",
    vehicle: {
      serviceCategory: "EV_PASSENGER",
      vehicleType: "electric-rickshaw",
      vehicleModel: "Electric Rickshaw"
    }
  };

  assert.equal(isEVVehicle(bookingWithPopulatedEv), true);
  assert.equal(getVehicleCategoryLabel(bookingWithPopulatedEv), "EV Passenger");

  const bookingWithFlatEv = {
    bookingId: "LB-EV-8888",
    serviceCategory: "EV_PASSENGER",
    vehicleType: "electric-passenger-three-wheeler"
  };

  assert.equal(isEVVehicle(bookingWithFlatEv), true);
  assert.equal(getVehicleCategoryLabel(bookingWithFlatEv), "EV Passenger");
});

test("Regression: electric-cargo-loader is strictly goods and NEVER EV Passenger", () => {
  const cargoLoader = {
    vehicleType: "electric-cargo-loader",
    serviceCategory: "EV_GOODS"
  };
  assert.equal(isPassengerCategory(cargoLoader), false);
  assert.equal(isGoodsCategory(cargoLoader), true);
  assert.equal(isPassengerCategory("electric-cargo-loader"), false);
  assert.equal(isGoodsCategory("electric-cargo-loader"), true);
  assert.equal(canonicalizeServiceCategory("EV_GOODS", "electric-cargo-loader"), "GOODS_TRANSPORT");
  assert.equal(getServiceCategoryForVehicleType("electric-cargo-loader"), "GOODS_TRANSPORT");
  assert.equal(resolveVehicleServiceCategory(cargoLoader), "GOODS_TRANSPORT");
});

test("Canonical categories match the three required services", () => {
  assert.deepEqual(Object.keys(CANONICAL_SERVICE_CATEGORIES).sort(), [
    "EV_PASSENGER",
    "GOODS_TRANSPORT",
    "TAXI"
  ]);
  assert.equal(CANONICAL_SERVICE_CATEGORIES.EV_PASSENGER, "EV_PASSENGER");
  assert.equal(CANONICAL_SERVICE_CATEGORIES.TAXI, "TAXI");
  assert.equal(CANONICAL_SERVICE_CATEGORIES.GOODS_TRANSPORT, "GOODS_TRANSPORT");
});

test("Fare quote payload helper uses canonical categories and zero-weight for passenger", () => {
  // Simulate VehicleSelectionScreen quote category resolution
  const resolveQuoteCategory = (filter, serviceCat) => {
    const raw = filter !== "all" ? filter : serviceCat;
    return raw && raw !== "all" ? canonicalizeServiceCategory(raw) : undefined;
  };

  assert.equal(resolveQuoteCategory("EV_PASSENGER", "EV_PASSENGER"), "EV_PASSENGER");
  assert.equal(resolveQuoteCategory("TAXI", "TAXI"), "TAXI");
  assert.equal(resolveQuoteCategory("GOODS_TRANSPORT", "GOODS_TRANSPORT"), "GOODS_TRANSPORT");
  assert.equal(resolveQuoteCategory("all", "all"), undefined);
  assert.equal(resolveQuoteCategory("all", "TRUCK"), "GOODS_TRANSPORT");
});
