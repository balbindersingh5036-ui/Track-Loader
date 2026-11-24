import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  VEHICLE_TYPES_BY_CATEGORY,
  canonicalizeServiceCategory,
  isPassengerCategory,
  isGoodsCategory,
  isValidCategoryVehicleType,
  getServiceCategoryForVehicleType,
  getCategoryEnabledSettingKey
} from "../src/utils/vehicleCategories.js";

test("Vehicle categories are correctly separated into 3 core services", () => {
  assert.equal(SERVICE_CATEGORIES.EV_PASSENGER, "EV_PASSENGER");
  assert.equal(SERVICE_CATEGORIES.TAXI, "TAXI");
  assert.equal(SERVICE_CATEGORIES.GOODS_TRANSPORT, "GOODS_TRANSPORT");

  // Display labels
  assert.equal(SERVICE_CATEGORY_LABELS[SERVICE_CATEGORIES.EV_PASSENGER], "EV Passenger");
  assert.equal(SERVICE_CATEGORY_LABELS[SERVICE_CATEGORIES.TAXI], "Taxi");
  assert.equal(SERVICE_CATEGORY_LABELS[SERVICE_CATEGORIES.GOODS_TRANSPORT], "Goods Transport");

  // Subcategories
  const evTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.EV_PASSENGER];
  assert.ok(evTypes.includes("electric-rickshaw"));
  assert.ok(evTypes.includes("electric-passenger-three-wheeler"));
  assert.ok(evTypes.includes("other-electric-passenger"));

  const taxiTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.TAXI];
  assert.ok(taxiTypes.includes("sedan"));
  assert.ok(taxiTypes.includes("hatchback"));
  assert.ok(taxiTypes.includes("suv"));

  const goodsTypes = VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.GOODS_TRANSPORT];
  assert.ok(goodsTypes.includes("pickup"));
  assert.ok(goodsTypes.includes("mini-truck"));
  assert.ok(goodsTypes.includes("small-truck"));
  assert.ok(goodsTypes.includes("medium-truck"));
  assert.ok(goodsTypes.includes("large-truck"));
});

test("isPassengerCategory and isGoodsCategory identify services by purpose", () => {
  assert.equal(isPassengerCategory("EV_PASSENGER"), true);
  assert.equal(isPassengerCategory("TAXI"), true);
  assert.equal(isPassengerCategory("GOODS_TRANSPORT"), false);
  assert.equal(isPassengerCategory("TRUCK"), false);

  assert.equal(isGoodsCategory("GOODS_TRANSPORT"), true);
  assert.equal(isGoodsCategory("TRUCK"), true);
  assert.equal(isGoodsCategory("EV_PASSENGER"), false);
  assert.equal(isGoodsCategory("TAXI"), false);

  // Backward-compatible legacy aliases
  assert.equal(isPassengerCategory("EV_GOODS"), true);
  assert.equal(isPassengerCategory("GOODS_TAXI"), true);
});

test("canonicalizeServiceCategory normalizes categories and legacy aliases", () => {
  assert.equal(canonicalizeServiceCategory("EV_PASSENGER"), "EV_PASSENGER");
  assert.equal(canonicalizeServiceCategory("EV_GOODS"), "EV_PASSENGER");
  assert.equal(canonicalizeServiceCategory("TAXI"), "TAXI");
  assert.equal(canonicalizeServiceCategory("GOODS_TAXI"), "TAXI");
  assert.equal(canonicalizeServiceCategory("GOODS_TRANSPORT"), "GOODS_TRANSPORT");
  assert.equal(canonicalizeServiceCategory("TRUCK"), "GOODS_TRANSPORT");
  assert.equal(canonicalizeServiceCategory(null), "GOODS_TRANSPORT");
});

test("EV Passenger vehicle requires electric fuel, positive battery range and charging information", async () => {
  const invalidPetrolEV = new Vehicle({
    vehicleNumber: "DL01EV1001",
    vehicleModel: "Mahindra Treo",
    vehicleType: "electric-rickshaw",
    serviceCategory: "EV_PASSENGER",
    fuelType: "petrol",
    seatingCapacity: 4,
    batteryRangeKm: 130,
    chargingInformation: "Standard 15A wall charger"
  });
  await assert.rejects(invalidPetrolEV.validate(), /EV Passenger vehicles must use electric power/);

  const validEV = new Vehicle({
    vehicleNumber: "DL01EV1002",
    vehicleModel: "Mahindra Treo Passenger",
    vehicleType: "electric-rickshaw",
    serviceCategory: "EV_PASSENGER",
    fuelType: "electric",
    seatingCapacity: 4,
    batteryRangeKm: 130,
    chargingInformation: "Standard 15A wall charger"
  });
  const err = await validEV.validate();
  assert.equal(err, undefined);
});

test("Taxi vehicle requires valid fuel type and supports seatingCapacity", async () => {
  const taxi = new Vehicle({
    vehicleNumber: "DL01TX2001",
    vehicleModel: "Maruti Dzire",
    vehicleType: "sedan",
    serviceCategory: "TAXI",
    fuelType: "cng",
    seatingCapacity: 4
  });
  const err = await taxi.validate();
  assert.equal(err, undefined);
  assert.equal(taxi.seatingCapacity, 4);
});

test("Goods vehicle requires valid vehicle type and loadCapacity", async () => {
  const goodsVehicle = new Vehicle({
    vehicleNumber: "DL01GT3001",
    vehicleModel: "Tata Ace Gold",
    vehicleType: "mini-truck",
    serviceCategory: "GOODS_TRANSPORT",
    fuelType: "diesel",
    loadCapacity: { value: 750, unit: "kg" }
  });
  const err = await goodsVehicle.validate();
  assert.equal(err, undefined);
  assert.equal(goodsVehicle.loadCapacity.value, 750);
});

test("Passenger bookings (EV Passenger & Taxi) do not require goods description or weight", async () => {
  const customerId = new mongoose.Types.ObjectId();

  const evPassengerBooking = new Booking({
    bookingId: "BKG-EV-PASS-001",
    customer: customerId,
    serviceCategory: "EV_PASSENGER",
    vehicleType: "electric-rickshaw",
    pickup: { address: "Station", latitude: 28.6139, longitude: 77.2090 },
    drop: { address: "Market", latitude: 28.6200, longitude: 77.2100 },
    preferredPickupDate: new Date("2026-12-01"),
    preferredPickupTime: "10:00",
    estimatedFare: 60,
    passengerCount: 2
  });
  const errEV = await evPassengerBooking.validate();
  assert.equal(errEV, undefined);
  assert.equal(evPassengerBooking.goods, "Passenger Transportation");
  assert.equal(evPassengerBooking.passengerCount, 2);

  const taxiBooking = new Booking({
    bookingId: "BKG-TAXI-001",
    customer: customerId,
    serviceCategory: "TAXI",
    vehicleType: "sedan",
    pickup: { address: "Airport", latitude: 28.5562, longitude: 77.1000 },
    drop: { address: "Hotel", latitude: 28.6300, longitude: 77.2200 },
    preferredPickupDate: new Date("2026-12-01"),
    preferredPickupTime: "14:00",
    estimatedFare: 350,
    passengerCount: 3
  });
  const errTaxi = await taxiBooking.validate();
  assert.equal(errTaxi, undefined);
  assert.equal(taxiBooking.goods, "Passenger Transportation");
  assert.equal(taxiBooking.passengerCount, 3);
});

test("Goods transport bookings enforce goods description and cargo weight", async () => {
  const customerId = new mongoose.Types.ObjectId();

  const goodsBooking = new Booking({
    bookingId: "BKG-GOODS-001",
    customer: customerId,
    serviceCategory: "GOODS_TRANSPORT",
    vehicleType: "pickup",
    pickup: { address: "Warehouse A", latitude: 28.5000, longitude: 77.1000 },
    drop: { address: "Retail Shop B", latitude: 28.5500, longitude: 77.1500 },
    preferredPickupDate: new Date("2026-12-01"),
    preferredPickupTime: "09:00",
    estimatedFare: 450,
    goods: "Cardboard boxes",
    weight: { value: 500, unit: "kg" }
  });
  const errGoods = await goodsBooking.validate();
  assert.equal(errGoods, undefined);
  assert.equal(goodsBooking.goods, "Cardboard boxes");
  assert.equal(goodsBooking.weight.value, 500);
});
