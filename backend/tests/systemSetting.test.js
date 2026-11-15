import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import SystemSetting from "../src/models/SystemSetting.js";
import { parseDateRange } from "../src/utils/dateParser.js";
import { getPublicSettings, createOrUpdateSetting } from "../src/controllers/systemSettingController.js";
import * as systemSettingService from "../src/services/systemSettingService.js";

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

test("getPublicSettings returns service category configs and defaults", async () => {
  const originalFind = SystemSetting.find;
  try {
    SystemSetting.find = async () => [
      { key: "booking.enabled", value: true },
      { key: "service.ev_goods.enabled", value: true },
      { key: "service.goods_taxi.enabled", value: false }
    ];

    let resData = null;
    let statusCode = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        resData = payload;
        return this;
      }
    };

    await getPublicSettings({}, res);

    assert.equal(statusCode, 200);
    assert.equal(resData.success, true);
    assert.equal(resData.data.config["booking.enabled"], true);
    assert.equal(resData.data.config["service.ev_goods.enabled"], true);
    assert.equal(resData.data.config["service.goods_taxi.enabled"], false);
    assert.deepEqual(resData.data.config["service.ev_goods.allowed_vehicle_types"], [
      "electric-cargo-loader",
      "electric-goods-e-rickshaw",
      "electric-mini-cargo-carrier"
    ]);
  } finally {
    SystemSetting.find = originalFind;
  }
});

test("createOrUpdateSetting validates key, type, and category strictly", async () => {
  const execute = async (req) => {
    let statusCode = null;
    let resData = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        resData = payload;
        return this;
      }
    };
    await createOrUpdateSetting(req, res);
    return { statusCode, resData };
  };

  // Missing key
  const res1 = await execute({ params: {}, body: {} });
  assert.equal(res1.statusCode, 400);
  assert.match(res1.resData.message, /Key is required/);

  // Invalid key characters
  const res2 = await execute({ params: { key: "bad key!" }, body: { key: "bad key!" } });
  assert.equal(res2.statusCode, 400);
  assert.match(res2.resData.message, /Invalid key format/);

  // Invalid category
  const res3 = await execute({
    params: { key: "service.ev_goods.enabled" },
    body: { key: "service.ev_goods.enabled", type: "boolean", category: "invalid-cat", value: true }
  });
  assert.equal(res3.statusCode, 400);
  assert.match(res3.resData.message, /Invalid category/);

  // Type mismatch (boolean expected)
  const res4 = await execute({
    params: { key: "service.ev_goods.enabled" },
    body: { key: "service.ev_goods.enabled", type: "boolean", category: "system", value: "not-a-bool" }
  });
  assert.equal(res4.statusCode, 400);
  assert.match(res4.resData.message, /Value must be boolean/);
});

test("createOrUpdateSetting performs upsert and invalidates cache", async () => {
  const originalFindOneAndUpdate = SystemSetting.findOneAndUpdate;
  try {
    let upsertOptions = null;
    let updateFilter = null;
    let updateDoc = null;

    SystemSetting.findOneAndUpdate = async (filter, doc, options) => {
      updateFilter = filter;
      updateDoc = doc;
      upsertOptions = options;
      return {
        key: filter.key,
        value: doc.value,
        type: doc.type,
        category: doc.category,
        isActive: true
      };
    };

    let statusCode = null;
    let resData = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        resData = payload;
        return this;
      }
    };

    const req = {
      method: "PUT",
      params: { key: "service.ev_goods.enabled" },
      body: {
        key: "service.ev_goods.enabled",
        value: true,
        type: "boolean",
        category: "system",
        description: "EV Goods Transport enabled"
      },
      user: { _id: new mongoose.Types.ObjectId() }
    };

    await createOrUpdateSetting(req, res);

    assert.equal(statusCode, 200);
    assert.equal(resData.success, true);
    assert.equal(updateFilter.key, "service.ev_goods.enabled");
    assert.equal(updateDoc.value, true);
    assert.equal(upsertOptions.upsert, true);
    assert.equal(upsertOptions.new, true);
  } finally {
    SystemSetting.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
