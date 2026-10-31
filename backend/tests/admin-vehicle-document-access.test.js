import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Vehicle from "../src/models/Vehicle.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import documentRoutes from "../src/routes/documentRoutes.js";
import { generateToken } from "../src/utils/generateToken.js";

const createApp = () => {
  const app = express();
  app.use("/documents", documentRoutes);
  return app;
};

const setSuperAdmin = (t, id) => {
  const previousEnvironment = process.env.SUPER_ADMIN_USER_ID;
  const previousConfig = env.superAdminUserId;
  process.env.SUPER_ADMIN_USER_ID = id.toString();
  env.superAdminUserId = id.toString();
  t.after(() => {
    if (previousEnvironment === undefined) delete process.env.SUPER_ADMIN_USER_ID;
    else process.env.SUPER_ADMIN_USER_ID = previousEnvironment;
    env.superAdminUserId = previousConfig;
  });
};

const mockAuthenticatedUser = (t, user) => {
  t.mock.method(User, "findById", () => ({
    select: async () => user
  }));
};

test("ordinary Admin is denied vehicle document viewing and receives no permanent URL", async (t) => {
  const designatedId = new mongoose.Types.ObjectId();
  const ordinaryAdmin = { _id: new mongoose.Types.ObjectId(), role: "admin", isActive: true };
  const vehicleId = new mongoose.Types.ObjectId();
  setSuperAdmin(t, designatedId);
  mockAuthenticatedUser(t, ordinaryAdmin);
  t.mock.method(Vehicle, "findById", async () => ({
    documents: { registration: { url: "https://res.cloudinary.com/test/private.png", publicId: "loadbalbin_kyc/rc" } }
  }));
  const signUrl = t.mock.method(cloudinary.utils, "private_download_url", () => "https://temporary.example/signed");

  const response = await request(createApp())
    .get(`/documents/vehicle/${vehicleId}/registration`)
    .set("Authorization", `Bearer ${generateToken({ userId: ordinaryAdmin._id.toString() })}`);

  assert.equal(response.status, 403);
  assert.equal(signUrl.mock.calls.length, 0);
  assert.equal(response.body.data, undefined);
});

test("designated Super Admin receives a temporary signed URL only for private-vault assets", async (t) => {
  const adminId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const admin = { _id: adminId, role: "admin", isActive: true };
  const document = {
    publicId: "loadbalbin_kyc/vehicle-rc",
    url: "https://res.cloudinary.com/test/private.png",
    format: "png",
    resourceType: "image",
    status: "pending",
    rejectionReason: ""
  };
  setSuperAdmin(t, adminId);
  mockAuthenticatedUser(t, admin);
  t.mock.method(Vehicle, "findById", async () => ({
    documents: { registration: document }
  }));
  const signUrl = t.mock.method(cloudinary.utils, "private_download_url", (publicId, format, options) => {
    assert.equal(publicId, document.publicId);
    assert.equal(format, "png");
    assert.equal(options.resource_type, "image");
    assert.equal(options.type, "authenticated");
    return "https://temporary.example/signed-rc";
  });

  const response = await request(createApp())
    .get(`/documents/vehicle/${vehicleId}/registration`)
    .set("Authorization", `Bearer ${generateToken({ userId: adminId.toString() })}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.document.viewUrl, "https://temporary.example/signed-rc");
  assert.equal(response.body.data.document.expiresInSeconds, 300);
  assert.notEqual(response.body.data.document.viewUrl, document.url);
  assert.equal(signUrl.mock.calls.length, 1);
});

test("designated Super Admin cannot preview a legacy public vehicle document URL", async (t) => {
  const adminId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const admin = { _id: adminId, role: "admin", isActive: true };
  setSuperAdmin(t, adminId);
  mockAuthenticatedUser(t, admin);
  t.mock.method(Vehicle, "findById", async () => ({
    documents: {
      insurance: {
        url: "https://legacy.example/public-insurance.pdf",
        publicId: "",
        status: "pending"
      }
    }
  }));
  const signUrl = t.mock.method(cloudinary.utils, "private_download_url", () => "https://temporary.example/signed");

  const response = await request(createApp())
    .get(`/documents/vehicle/${vehicleId}/insurance`)
    .set("Authorization", `Bearer ${generateToken({ userId: adminId.toString() })}`);

  assert.equal(response.status, 409);
  assert.equal(signUrl.mock.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(response.body), /legacy\.example/);
});
