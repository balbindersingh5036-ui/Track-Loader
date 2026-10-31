import assert from "node:assert/strict";
import test from "node:test";
import { agencyOnly } from "../src/middleware/agencyMiddleware.js";

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test("Agency management middleware permits only Agency-role accounts", () => {
  let continued = false;
  const res = response();
  agencyOnly({ user: { role: "agency" } }, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});

test("Agency management middleware denies Driver, customer, and Admin accounts", () => {
  for (const role of ["driver", "customer", "admin"]) {
    let continued = false;
    const res = response();
    agencyOnly({ user: { role } }, res, () => { continued = true; });
    assert.equal(continued, false);
    assert.equal(res.statusCode, 403);
  }
});
