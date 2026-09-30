import assert from "node:assert/strict";
import test from "node:test";

import Vehicle from "../src/models/Vehicle.js";

test("vehicle schema defines supported types and capacity units", () => {
  assert.deepEqual(Vehicle.schema.path("vehicleType").enumValues, [
    "mini-truck",
    "pickup",
    "small-truck",
    "medium-truck",
    "large-truck"
  ]);
  assert.deepEqual(Vehicle.schema.path("loadCapacity.unit").enumValues, [
    "kg",
    "ton"
  ]);
  assert.equal(Vehicle.schema.path("driver").options.required, true);
});
