import assert from "node:assert/strict";
import test from "node:test";

import Booking from "../src/models/Booking.js";

test("booking schema supports the customer summary statuses", () => {
  const statuses = Booking.schema.path("bookingStatus").enumValues;

  assert.deepEqual(
    statuses,
    ["pending", "accepted", "rejected", "cancelled", "in-progress", "completed"]
  );
  assert.equal(Booking.schema.path("customer").options.required, true);
  assert.deepEqual(
    Booking.schema.path("assignmentStatus").enumValues,
    ["unassigned", "pending_acceptance", "accepted", "rejected"]
  );
  assert.ok(Booking.schema.path("assignmentHistory"));

  const bookingModes = Booking.schema.path("bookingMode").enumValues;
  assert.deepEqual(bookingModes, ["instant", "scheduled"]);
  assert.equal(Booking.schema.path("alternativeVehicleAssigned").instance, "Boolean");
});
