import assert from "node:assert/strict";
import test from "node:test";

import Vehicle from "../src/models/Vehicle.js";

test("vehicle schema defines supported types and capacity units", () => {
  const types = Vehicle.schema.path("vehicleType").enumValues;
  assert.ok(types.includes("electric-rickshaw"));
  assert.ok(types.includes("electric-passenger-three-wheeler"));
  assert.ok(types.includes("other-electric-passenger"));
  assert.ok(types.includes("sedan"));
  assert.ok(types.includes("hatchback"));
  assert.ok(types.includes("suv"));
  assert.ok(types.includes("pickup"));
  assert.ok(types.includes("mini-truck"));
  assert.ok(types.includes("small-truck"));
  assert.ok(types.includes("medium-truck"));
  assert.ok(types.includes("large-truck"));

  const categories = Vehicle.schema.path("serviceCategory").enumValues;
  assert.ok(categories.includes("EV_PASSENGER"));
  assert.ok(categories.includes("TAXI"));
  assert.ok(categories.includes("GOODS_TRANSPORT"));
  // Legacy aliases supported
  assert.ok(categories.includes("TRUCK"));
  assert.ok(categories.includes("EV_GOODS"));
  assert.ok(categories.includes("GOODS_TAXI"));

  assert.deepEqual(Vehicle.schema.path("fuelType").enumValues, [
    "petrol",
    "diesel",
    "cng",
    "electric"
  ]);
  assert.deepEqual(Vehicle.schema.path("loadCapacity.unit").enumValues, [
    "kg",
    "ton"
  ]);
  assert.notEqual(Vehicle.schema.path("driver").options.required, true);
  assert.equal(Vehicle.schema.path("driver").defaultValue, null);
});
