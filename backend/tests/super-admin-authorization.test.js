import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { superAdminOnly } from "../src/middleware/superAdminMiddleware.js";

const response = () => ({
  statusCode: 200,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test("agency KYC and approval actions fail closed unless the designated Super Admin is configured", (t) => {
  const previous = env.superAdminUserId;
  t.after(() => {
    env.superAdminUserId = previous;
  });
  env.superAdminUserId = "";

  const res = response();
  let nextCalled = false;
  superAdminOnly({ user: { role: "admin", _id: new mongoose.Types.ObjectId() } }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});

test("ordinary administrators cannot use designated Super Admin review actions", (t) => {
  const previous = env.superAdminUserId;
  t.after(() => {
    env.superAdminUserId = previous;
  });
  const designatedId = new mongoose.Types.ObjectId();
  env.superAdminUserId = designatedId.toString();

  const res = response();
  let nextCalled = false;
  superAdminOnly({ user: { role: "admin", _id: new mongoose.Types.ObjectId() } }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});

test("only the configured Super Admin identity passes the review middleware", (t) => {
  const previous = env.superAdminUserId;
  t.after(() => {
    env.superAdminUserId = previous;
  });
  const designatedId = new mongoose.Types.ObjectId();
  env.superAdminUserId = designatedId.toString();

  const res = response();
  let nextCalled = false;
  superAdminOnly({ user: { role: "admin", _id: designatedId } }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});
