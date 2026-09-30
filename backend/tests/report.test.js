import assert from "node:assert/strict";
import test from "node:test";
import { parseDateRange } from "../src/utils/dateParser.js";

test("date parser successfully parses valid date range", () => {
  const result = parseDateRange("2026-01-01", "2026-01-31");
  assert.ok(result.from instanceof Date);
  assert.ok(result.to instanceof Date);
  assert.equal(result.match.$gte.toISOString().startsWith("2026-01-01"), true);
  // Ends at 23:59:59.999
  assert.equal(result.match.$lte.getUTCHours(), 23);
});

test("date parser throws on from > to", () => {
  assert.throws(() => parseDateRange("2026-02-01", "2026-01-01"), /cannot be after/);
});

test("date parser gracefully ignores invalid strings", () => {
  const result = parseDateRange("invalid-date", "invalid");
  assert.equal(result.from, null);
  assert.equal(result.to, null);
  assert.equal(Object.keys(result.match).length, 0);
});
