import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import { adminLogin, agencyLogin, driverLogin, register } from "../src/controllers/authController.js";
import { clearCache } from "../src/services/systemSettingService.js";
import { hashPassword } from "../src/utils/password.js";

const response = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const selectedUser = (user) => ({
  select() { return this; },
  then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); }
});

test("customer registration sets its own role and normalizes email", async (t) => {
  clearCache();
  t.after(() => clearCache());
  t.mock.method(SystemSetting, "findOne", async () => null);
  let createdUser;
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => {
    createdUser = { _id: new mongoose.Types.ObjectId(), ...data };
    return createdUser;
  });

  const res = response();
  await register({
    body: {
      name: "Registration Customer",
      phone: "+919811122236",
      email: "  Customer@Example.com ",
      password: "password1",
      role: "admin"
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, "customer");
  assert.equal(createdUser.email, "customer@example.com");
  assert.equal(res.body.data.user.role, "customer");
});

test("customer registration rejects duplicate email before creating an account", async (t) => {
  clearCache();
  t.after(() => clearCache());
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(User, "findOne", async (query) =>
    query.email ? { _id: new mongoose.Types.ObjectId() } : null
  );
  t.mock.method(User, "create", async () => assert.fail("Duplicate email must not create User"));

  const res = response();
  await register({
    body: {
      name: "Duplicate Customer",
      phone: "+919811122237",
      email: "existing@example.com",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /email address already registered/i);
});

test("customer registration rejects duplicate phone before creating an account", async (t) => {
  clearCache();
  t.after(() => clearCache());
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(User, "findOne", async (query) =>
    query.phone ? { _id: new mongoose.Types.ObjectId() } : null
  );
  t.mock.method(User, "create", async () => assert.fail("Duplicate phone must not create User"));

  const res = response();
  await register({
    body: {
      name: "Duplicate Phone Customer",
      phone: "+919811122237",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /phone number already registered/i);
});

test("pending verified Driver can log in to restricted verification mode", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const password = "password1";
  const user = {
    _id: userId,
    name: "Pending Driver",
    phone: "9811122238",
    email: "pending-driver@example.com",
    password: await hashPassword(password),
    role: "driver",
    isActive: true,
    async save() { return this; }
  };
  const driver = {
    _id: driverId,
    fullName: "Pending Driver",
    agency: null,
    agencyAssociation: { status: "none" },
    approvalStatus: "pending",
    isActive: true
  };
  t.mock.method(User, "findOne", () => selectedUser(user));
  t.mock.method(Driver, "findOne", async (filter) => {
    assert.deepEqual(filter, { user: userId });
    return driver;
  });

  const res = response();
  await driverLogin({
    body: { phone: user.phone, password }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.role, "driver");
  assert.equal(res.body.data.driver.id, driverId);
  assert.equal(res.body.data.driver.approvalStatus, "pending");
  assert.equal(res.body.data.driver.agencyAssociation.status, "none");
  assert.ok(res.body.data.token);
});

test("Agency Owner login uses the admin-panel login route and returns Agency role", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const password = "password1";
  const user = {
    _id: userId,
    name: "Agency Owner",
    phone: "9811122239",
    email: "agency-owner@example.com",
    password: await hashPassword(password),
    role: "agency",
    isActive: true,
    async save() { return this; }
  };
  const agency = { _id: new mongoose.Types.ObjectId(), owner: userId, approvalStatus: "pending" };
  t.mock.method(User, "findOne", (query) => {
    assert.deepEqual(query.role, { $in: ["admin", "agency"] });
    return selectedUser(user);
  });

  test("Agency mobile login only authenticates Agency-role owners with an Agency profile", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const password = "password1";
    const user = {
      _id: userId,
      name: "Mobile Agency Owner",
      phone: "9811122240",
      email: "mobile-agency@example.com",
      password: await hashPassword(password),
      role: "agency",
      isActive: true,
      async save() { return this; }
    };
    const agency = { _id: new mongoose.Types.ObjectId(), owner: userId };
    t.mock.method(User, "findOne", (query) => {
      assert.equal(query.role, "agency");
      return selectedUser(user);
    });
    t.mock.method(Agency, "findOne", (query) => ({
      lean: async () => {
        assert.deepEqual(query, { owner: userId });
        return agency;
      }
    }));

    const res = response();
    await agencyLogin({ body: { identifier: user.phone, password } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.user.role, "agency");
    assert.equal(res.body.data.agency._id, agency._id);
    assert.ok(res.body.data.token);
  });

  test("Agency mobile login does not authenticate Admin accounts", async (t) => {
    t.mock.method(User, "findOne", (query) => {
      assert.equal(query.role, "agency");
      return selectedUser(null);
    });
    t.mock.method(Agency, "findOne", async () => assert.fail("Admin login must not query an Agency profile"));

    const res = response();
    await agencyLogin({ body: { identifier: "admin@example.com", password: "password1" } }, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /invalid credentials/i);
  });
  t.mock.method(Agency, "findOne", (query) => ({
    lean: async () => {
      assert.deepEqual(query, { owner: userId });
      return agency;
    }
  }));

  const res = response();
  await adminLogin({
    body: { email: user.email, password }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.role, "agency");
  assert.equal(res.body.data.agency._id, agency._id);
  assert.ok(res.body.data.token);
});
