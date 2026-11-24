import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import { login, driverLogin, agencyLogin, normalizePhoneNumber } from "../src/controllers/authController.js";
import { hashPassword } from "../src/utils/password.js";

const mockResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});

const selectedUser = (user) => ({
  select() { return this; },
  then(resolve, reject) { return Promise.resolve(user).then(resolve, reject); }
});

test("normalizePhoneNumber normalizes 10, 11 (0 prefix), and 12 (91 prefix) digit phone numbers", () => {
  assert.equal(normalizePhoneNumber("9876543210"), "9876543210");
  assert.equal(normalizePhoneNumber("+919876543210"), "9876543210");
  assert.equal(normalizePhoneNumber("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhoneNumber("919876543210"), "9876543210");
  assert.equal(normalizePhoneNumber("09876543210"), "9876543210");
  assert.equal(normalizePhoneNumber(""), "");
});

test("Customer login succeeds with mobile number (+91 normalized)", async (t) => {
  const hashedPassword = await hashPassword("validpass123");
  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    name: "Customer One",
    phone: "9876543210",
    email: "customer@example.com",
    role: "customer",
    password: hashedPassword,
    isActive: true,
    save: async () => {}
  };

  t.mock.method(User, "findOne", (query) => {
    // Check that phone query matches
    if (query.$or) {
      const matchesPhone = query.$or.some(c => c.phone && c.phone.$in && c.phone.$in.includes("9876543210"));
      if (matchesPhone) return selectedUser(testUser);
    }
    return selectedUser(null);
  });

  const res = mockResponse();
  await login({
    body: {
      phone: "+91 98765 43210",
      password: "validpass123"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.phone, "9876543210");
  assert.ok(res.body.data.token, "JWT token must be returned");
});

test("Customer login succeeds with email address", async (t) => {
  const hashedPassword = await hashPassword("validpass123");
  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    name: "Customer Two",
    phone: "9876543211",
    email: "customer2@example.com",
    role: "customer",
    password: hashedPassword,
    isActive: true,
    save: async () => {}
  };

  t.mock.method(User, "findOne", (query) => {
    if (query.$or) {
      const matchesEmail = query.$or.some(c => c.email === "customer2@example.com");
      if (matchesEmail) return selectedUser(testUser);
    }
    return selectedUser(null);
  });

  const res = mockResponse();
  await login({
    body: {
      identifier: "Customer2@Example.COM",
      password: "validpass123"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, "customer2@example.com");
});

test("Driver login succeeds with mobile number and email", async (t) => {
  const hashedPassword = await hashPassword("driverpass123");
  const testUserId = new mongoose.Types.ObjectId();
  const testUser = {
    _id: testUserId,
    name: "Driver One",
    phone: "9812345678",
    email: "driver1@example.com",
    role: "driver",
    password: hashedPassword,
    isActive: true,
    save: async () => {}
  };

  const testDriver = {
    _id: new mongoose.Types.ObjectId(),
    user: testUserId,
    fullName: "Driver One",
    agency: null,
    approvalStatus: "approved",
    isActive: true,
    isOnline: true,
    rating: 4.8,
    totalTrips: 15
  };

  t.mock.method(User, "findOne", (query) => {
    assert.equal(query.role, "driver");
    return selectedUser(testUser);
  });
  t.mock.method(Driver, "findOne", () => Promise.resolve(testDriver));

  // Test with phone
  const resPhone = mockResponse();
  await driverLogin({
    body: {
      phone: "+91 98123 45678",
      password: "driverpass123"
    }
  }, resPhone);

  assert.equal(resPhone.statusCode, 200);
  assert.equal(resPhone.body.success, true);
  assert.equal(resPhone.body.data.user.phone, "9812345678");

  // Test with email
  const resEmail = mockResponse();
  await driverLogin({
    body: {
      identifier: "Driver1@Example.com",
      password: "driverpass123"
    }
  }, resEmail);

  assert.equal(resEmail.statusCode, 200);
  assert.equal(resEmail.body.success, true);
  assert.equal(resEmail.body.data.user.email, "driver1@example.com");
});

test("Agency login succeeds with email and mobile number", async (t) => {
  const hashedPassword = await hashPassword("agencypass123");
  const testUserId = new mongoose.Types.ObjectId();
  const testUser = {
    _id: testUserId,
    name: "Agency Owner",
    phone: "9900011122",
    email: "agency@example.com",
    role: "agency",
    password: hashedPassword,
    isActive: true,
    save: async () => {}
  };

  const testAgency = {
    _id: new mongoose.Types.ObjectId(),
    owner: testUserId,
    agencyName: "Fast Transport Agency"
  };

  t.mock.method(User, "findOne", (query) => {
    assert.equal(query.role, "agency");
    return selectedUser(testUser);
  });
  t.mock.method(Agency, "findOne", () => ({
    lean: () => Promise.resolve(testAgency)
  }));

  const resEmail = mockResponse();
  await agencyLogin({
    body: {
      email: "agency@example.com",
      password: "agencypass123"
    }
  }, resEmail);

  assert.equal(resEmail.statusCode, 200);
  assert.equal(resEmail.body.success, true);
  assert.equal(resEmail.body.data.user.email, "agency@example.com");
});

test("Login rejects invalid credentials without exposing user existence", async (t) => {
  t.mock.method(User, "findOne", () => selectedUser(null));

  const res = mockResponse();
  await login({
    body: {
      identifier: "nonexistent@example.com",
      password: "password123"
    }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Invalid mobile number, email, or password");
});

test("Login rejects empty identifier or password with 400", async () => {
  const res = mockResponse();
  await login({
    body: {
      identifier: "",
      password: ""
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});
