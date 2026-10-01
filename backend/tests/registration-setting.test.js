import assert from "node:assert/strict";
import test from "node:test";
import SystemSetting from "../src/models/SystemSetting.js";
import { register } from "../src/controllers/authController.js";
import { getPublicSettings } from "../src/controllers/systemSettingController.js";
import { clearCache } from "../src/services/systemSettingService.js";

test("customer registration respects the public registration feature setting", async (t) => {
  t.after(() => clearCache("customer.registrationEnabled"));
  clearCache("customer.registrationEnabled");
  t.mock.method(SystemSetting, "findOne", async () => ({ value: false }));
  const response = {
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
  };

  await register({ body: {} }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, "Customer registration is currently unavailable");
});

test("public customer configuration exposes the payment feature flag", async (t) => {
  t.mock.method(SystemSetting, "find", async (filter) => {
    assert.ok(filter.key.$in.includes("payment.enabled"));
    return [{ key: "payment.enabled", value: true }];
  });
  const response = {
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
  };

  await getPublicSettings({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.config["payment.enabled"], true);
});

test("public customer settings query normalized database keys and preserve API aliases", async (t) => {
  t.mock.method(SystemSetting, "find", async (filter) => {
    assert.ok(filter.key.$in.includes("customer.registrationenabled"));
    assert.ok(filter.key.$in.includes("system.maintenancemode"));
    return [
      { key: "customer.registrationenabled", value: true },
      { key: "system.maintenancemode", value: false }
    ];
  });
  const response = {
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
  };

  await getPublicSettings({}, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.config["customer.registrationEnabled"], true);
  assert.equal(response.body.data.config["system.maintenanceMode"], false);
});
