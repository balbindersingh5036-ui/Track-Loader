import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import SystemSetting from "../src/models/SystemSetting.js";
import { parseDateRange } from "../src/utils/dateParser.js";

test("system setting schema fields", () => {
  const paths = SystemSetting.schema.paths;
  assert.ok(paths.key);
  assert.ok(paths.value);
  assert.ok(paths.type);
  assert.ok(paths.category);
  assert.ok(paths.isActive);
  assert.ok(paths.updatedBy);
});

test("system setting validates supported types", () => {
  const types = SystemSetting.schema.path("type").enumValues;
  assert.deepEqual(types, ["string", "number", "boolean", "json"]);
});

test("system setting validates supported categories", () => {
  const categories = SystemSetting.schema.path("category").enumValues;
  assert.deepEqual(categories, [
    "general", "booking", "fare", "payment",
    "notification", "driver", "customer", "system"
  ]);
});
