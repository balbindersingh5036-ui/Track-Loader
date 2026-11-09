import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import app from "../src/app.js";
import SystemSetting from "../src/models/SystemSetting.js";

test("GET /api/health returns 200 and healthy message", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => null);
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "LoadBalbin API is healthy");
});

test("GET /api/config/public returns 200 with public config payload", async (t) => {
  t.mock.method(SystemSetting, "findOne", async () => null);
  t.mock.method(SystemSetting, "find", async () => [
    { key: "booking.enabled", value: true },
    { key: "customer.registrationenabled", value: true },
    { key: "payment.enabled", value: true },
    { key: "system.maintenancemode", value: false },
    { key: "system.supportemail", value: "support@loadbalbin.com" }
  ]);

  const res = await request(app)
    .get("/api/config/public")
    .set("Origin", "http://localhost:8082");

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Public config fetched");
  assert.ok(res.body.data?.config);
  assert.equal(res.body.data.config["booking.enabled"], true);
  assert.equal(res.body.data.config["customer.registrationEnabled"], true);
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:8082");
});

test("OPTIONS /api/config/public responds to CORS preflight from frontend", async () => {
  const res = await request(app)
    .options("/api/config/public")
    .set("Origin", "http://localhost:8082")
    .set("Access-Control-Request-Method", "GET");

  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:8082");
});
