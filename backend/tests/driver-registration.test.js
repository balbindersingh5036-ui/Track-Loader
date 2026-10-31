import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import SystemSetting from "../src/models/SystemSetting.js";
import User from "../src/models/User.js";
import request from "supertest";
import app from "../src/app.js";
import { getVerifiedAgencies } from "../src/controllers/agencyController.js";
import { registerDriver } from "../src/controllers/authController.js";

const createResponse = () => ({
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

const mockQuery = (value) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("verified agency list filters to active approved agencies and only selects public fields", async (t) => {
  const agencies = [{ _id: new mongoose.Types.ObjectId(), agencyName: "Approved Fleet", city: "Ludhiana" }];
  let filter;
  let projection;
  t.mock.method(Agency, "find", (query) => {
    filter = query;
    return {
      select(fields) {
        projection = fields;
        return this;
      },
      sort() { return this; },
      lean: async () => agencies
    };
  });

  const res = createResponse();
  await getVerifiedAgencies({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { approvalStatus: "approved", isActive: true });
  assert.equal(projection, "_id agencyName city");
  assert.deepEqual(res.body.data.agencies, agencies);
});

test("public GET /api/agency/verified route returns the safe agency-list structure", async (t) => {
  const agencies = [{
    _id: new mongoose.Types.ObjectId().toString(),
    agencyName: "Approved Fleet",
    city: "Ludhiana"
  }];
  let filter;
  let projection;
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(Agency, "find", (query) => {
    filter = query;
    return {
      select(fields) {
        projection = fields;
        return this;
      },
      sort() { return this; },
      lean: async () => agencies
    };
  });

  const response = await request(app).get("/api/agency/verified");

  assert.equal(response.status, 200);
  assert.deepEqual(filter, { approvalStatus: "approved", isActive: true });
  assert.equal(projection, "_id agencyName city");
  assert.deepEqual(response.body, {
    success: true,
    message: "Verified agencies fetched",
    data: { agencies }
  });
  for (const agency of response.body.data.agencies) {
    assert.deepEqual(Object.keys(agency).sort(), ["_id", "agencyName", "city"]);
  }
});

test("public verified agency route returns an empty list when no eligible agencies exist", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(Agency, "find", () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => []
  }));

  const response = await request(app).get("/api/agency/verified");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.agencies, []);
});

test("public driver-registration route rejects an unavailable agency without authentication", async (t) => {
  let userCreated = false;
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(Agency, "findOne", () => mockQuery(null));
  t.mock.method(User, "create", async () => {
    userCreated = true;
  });

  const response = await request(app)
    .post("/api/auth/driver/register")
    .send({
      fullName: "Driver Applicant",
      phone: "9811122233",
      password: "password1",
      agencyId: new mongoose.Types.ObjectId().toString()
    });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /selected agency is unavailable/i);
  assert.equal(userCreated, false);
});

test("driver registration links both records to the selected eligible agency and remains pending", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  let agencyFilter;
  let userData;
  let driverData;

  t.mock.method(Agency, "findOne", (query) => {
    agencyFilter = query;
    return mockQuery({ _id: agencyId });
  });
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => {
    userData = data;
    return { _id: userId, ...data };
  });
  t.mock.method(Driver, "create", async (data) => {
    driverData = data;
    return { _id: driverId, ...data };
  });

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Ramesh Kumar",
      phone: "+919811122233",
      email: "ramesh@example.com",
      password: "secure-password",
      agencyId: agencyId.toString(),
      role: "agency",
      approvalStatus: "approved",
      isActive: true
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(agencyFilter, {
    _id: agencyId.toString(),
    approvalStatus: "approved",
    isActive: true
  });
  assert.equal(userData.role, "driver");
  assert.equal(userData.phone, "9811122233");
  assert.equal(driverData.user.toString(), userId.toString());
  assert.equal(driverData.agency.toString(), agencyId.toString());
  assert.equal(driverData.approvalStatus, "pending");
  assert.equal(driverData.agencyAssociation.status, "pending");
  assert.equal(res.body.data.driver.id, driverId);
});

test("independent registration controls role and initializes a genuine standalone Driver profile", async (t) => {
  let userData;
  let driverData;
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => {
    userData = data;
    return { _id: new mongoose.Types.ObjectId(), ...data };
  });
  t.mock.method(Driver, "create", async (data) => {
    driverData = data;
    return { _id: new mongoose.Types.ObjectId(), ...data };
  });

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Standalone Driver",
      phone: "9811122234",
      password: "password1",
      role: "agency",
      approvalStatus: "approved",
      agency: new mongoose.Types.ObjectId().toString()
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(userData.role, "driver");
  assert.equal(res.body.data.user.role, "driver");
  assert.equal(driverData.agency, null);
  assert.equal(driverData.agencyAssociation.status, "none");
  assert.equal(driverData.approvalStatus, "pending");
});

test("driver registration rejects duplicate email without creating a User or Driver", async (t) => {
  const userQueries = [];
  t.mock.method(User, "findOne", async (query) => {
    userQueries.push(query);
    return query.email ? { _id: new mongoose.Types.ObjectId() } : null;
  });
  t.mock.method(User, "create", async () => assert.fail("Duplicate email must not create User"));
  t.mock.method(Driver, "create", async () => assert.fail("Duplicate email must not create Driver"));

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Duplicate Email",
      phone: "9811122235",
      email: "  existing@example.com ",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /email address already registered/i);
  assert.deepEqual(userQueries[1], { email: "existing@example.com" });
});

test("driver registration rejects duplicate phone without creating a Driver profile", async (t) => {
  t.mock.method(User, "findOne", async (query) =>
    query.phone ? { _id: new mongoose.Types.ObjectId() } : null
  );
  t.mock.method(User, "create", async () => assert.fail("Duplicate phone must not create User"));
  t.mock.method(Driver, "create", async () => assert.fail("Duplicate phone must not create Driver"));

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Duplicate Phone Driver",
      phone: "9811122235",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /phone number already registered/i);
});

test("driver registration rejects malformed, pending, rejected, suspended, and inactive agencies", async (t) => {
  let userCreated = false;
  const filters = [];
  t.mock.method(User, "create", async () => {
    userCreated = true;
  });

  const malformedResponse = createResponse();
  await registerDriver({
    body: {
      fullName: "Driver",
      phone: "9811122233",
      password: "password1",
      agencyId: "not-an-object-id"
    }
  }, malformedResponse);
  assert.equal(malformedResponse.statusCode, 400);
  assert.equal(userCreated, false);

  t.mock.method(Agency, "findOne", (query) => {
    filters.push(query);
    return mockQuery(null);
  });
  for (const disallowedState of ["pending", "rejected", "suspended", "inactive"]) {
    const unavailableResponse = createResponse();
    await registerDriver({
      body: {
        fullName: "Driver",
        phone: "9811122233",
        password: "password1",
        agencyId: new mongoose.Types.ObjectId().toString()
      }
    }, unavailableResponse);
    assert.equal(unavailableResponse.statusCode, 400, `${disallowedState} agency should be rejected`);
  }
  assert.equal(filters.length, 4);
  for (const filter of filters) {
    assert.equal(filter.approvalStatus, "approved");
    assert.equal(filter.isActive, true);
  }
  assert.equal(userCreated, false);
});

test("driver registration rolls back the user when driver creation fails", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  let deletedUserId;
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => ({ _id: userId, ...data }));
  t.mock.method(User, "deleteOne", async ({ _id }) => {
    deletedUserId = _id;
  });
  t.mock.method(Driver, "create", async () => {
    throw new Error("driver insert failed");
  });

  const res = createResponse();
  await registerDriver({
    body: {
      fullName: "Independent Driver",
      phone: "9811122233",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(deletedUserId.toString(), userId.toString());
});
