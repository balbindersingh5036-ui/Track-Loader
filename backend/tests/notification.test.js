import assert from "node:assert/strict";
import test from "node:test";
import Notification from "../src/models/Notification.js";

test("notification schema enforces recipient requirement", () => {
  assert.equal(Notification.schema.path("recipient").options.required, true);
  assert.equal(Notification.schema.path("title").options.required, true);
  assert.equal(Notification.schema.path("message").options.required, true);
});

test("notification types include booking and system", () => {
  const types = Notification.schema.path("type").enumValues;
  assert.ok(types.includes("booking"));
  assert.ok(types.includes("system"));
});
