import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import express from "express";
import request from "supertest";

import Agency from "../src/models/Agency.js";
import User from "../src/models/User.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import { registerAgency } from "../src/controllers/agencyController.js";
import { validatePrivateDocument } from "../src/controllers/documentController.js";
import { handleUploadFields } from "../src/middleware/uploadMiddleware.js";

const docTypes = ["ownerAadhaar", "businessRegistration", "tradeLicense", "gstCertificate", "taxId"];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

const file = (buffer = png, mimetype = "image/png") => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname: "document.png"
});

const registrationRequest = (files = {}) => ({
  user: { _id: new mongoose.Types.ObjectId(), role: "customer" },
  body: {
    agencyName: "Test Logistics",
    phone: `+9198${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, "0")}`
  },
  files: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, [value]]))
});

const mockCloudinary = (t, uploaded = [], deleted = [], uploadImpl) => {
  const previous = { ...env.cloudinary };
  Object.assign(env.cloudinary, { apiKey: "test-key", apiSecret: "test-secret", cloudName: "test-cloud" });
  t.after(() => Object.assign(env.cloudinary, previous));
  t.mock.method(cloudinary.uploader, "upload", uploadImpl || (async () => {
    const asset = {
      secure_url: `https://res.cloudinary.com/test/image/upload/private-${uploaded.length}.png`,
      public_id: `loadbalbin_kyc/registration-${uploaded.length}`,
      resource_type: "image",
      format: "png"
    };
    uploaded.push(asset);
    return asset;
  }));
  t.mock.method(cloudinary.uploader, "destroy", async (publicId) => {
    deleted.push(publicId);
    return { result: "ok" };
  });
  t.mock.method(cloudinary.utils, "private_download_url", (publicId) => `https://signed.example/${publicId}`);
};

test("agency registration requires owner Aadhaar before any mutation", async (t) => {
  let queried = false;
  const uploaded = [];
  t.mock.method(Agency, "findOne", async () => {
    queried = true;
    return null;
  });
  t.mock.method(Agency, "create", async () => assert.fail("Agency must not be created"));
  t.mock.method(User, "findByIdAndUpdate", async () => assert.fail("User role must not change"));
  mockCloudinary(t);

  const res = createResponse();
  await registerAgency(registrationRequest(), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Aadhaar.*required/i);
  assert.equal(queried, false);
  assert.equal(uploaded.length, 0);
});

test("registration accepts Aadhaar with optional documents omitted and serializes private metadata safely", async (t) => {
  let created;
  let roleUpdated = false;
  const ownerId = new mongoose.Types.ObjectId();
  const uploaded = [];
  mockCloudinary(t, uploaded);
  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async (data) => {
    created = data;
    return { _id: new mongoose.Types.ObjectId(), ...data, toObject() { return this; } };
  });
  t.mock.method(User, "findByIdAndUpdate", async () => {
    roleUpdated = true;
    return {};
  });

  const req = registrationRequest({ ownerAadhaar: file() });
  req.user._id = ownerId;
  const res = createResponse();
  await registerAgency(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(roleUpdated, true);
  assert.deepEqual(Object.keys(created.documents), ["ownerAadhaar"]);
  assert.equal(created.documents.ownerAadhaar.status, "pending");
  assert.equal(created.documents.ownerAadhaar.uploadedBy.toString(), ownerId.toString());
  assert.ok(created.documents.ownerAadhaar.submittedAt instanceof Date);
  assert.deepEqual(Object.keys(res.body.data.agency.documents), docTypes);
  assert.equal(res.body.data.agency.documents.ownerAadhaar.status, "pending");
  assert.equal(res.body.data.agency.documents.ownerAadhaar.viewUrl, "https://signed.example/loadbalbin_kyc/registration-0");
  for (const doc of Object.values(res.body.data.agency.documents)) {
    assert.equal(Object.hasOwn(doc, "url"), false);
    assert.equal(Object.hasOwn(doc, "publicId"), false);
  }
});

test("registration persists every submitted document with pending status and uploader metadata", async (t) => {
  let created;
  const uploaded = [];
  mockCloudinary(t, uploaded);
  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async (data) => {
    created = data;
    return { _id: new mongoose.Types.ObjectId(), ...data };
  });
  t.mock.method(User, "findByIdAndUpdate", async () => ({}));

  const req = registrationRequest(Object.fromEntries(docTypes.map((key) => [key, file()])));
  const res = createResponse();
  await registerAgency(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(created.documents), docTypes);
  assert.equal(uploaded.length, docTypes.length);
  for (const docType of docTypes) {
    const document = created.documents[docType];
    assert.equal(document.status, "pending");
    assert.equal(document.uploadedBy.toString(), req.user._id.toString());
    assert.ok(document.submittedAt instanceof Date);
    assert.ok(document.publicId.startsWith("loadbalbin_kyc/"));
  }
});

test("invalid document content and files over 5MB are rejected", () => {
  assert.throws(() => validatePrivateDocument(file(Buffer.from("not an image"))), /supported image or PDF/i);
  assert.throws(
    () => validatePrivateDocument(file(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")),
    /5MB/i
  );
});

test("multipart registration parser accepts only the five document field names", async () => {
  const app = express();
  app.post("/register", handleUploadFields(docTypes), (req, res) => {
    res.json({ fields: Object.keys(req.files) });
  });

  const accepted = request(app).post("/register")
    .field("agencyName", "Test Logistics")
    .attach("ownerAadhaar", png, "aadhaar.png")
    .attach("tradeLicense", png, "license.png");
  const acceptedResponse = await accepted;
  assert.equal(acceptedResponse.status, 200);
  assert.deepEqual(acceptedResponse.body.fields, ["ownerAadhaar", "tradeLicense"]);

  const rejectedResponse = await request(app).post("/register")
    .attach("aadhaar", png, "aadhaar.png");
  assert.equal(rejectedResponse.status, 400);
  assert.match(rejectedResponse.body.message, /Unexpected field/i);
});

test("duplicate registration remains rejected without uploading or changing the user role", async (t) => {
  const existing = { _id: new mongoose.Types.ObjectId() };
  const uploaded = [];
  let roleUpdated = false;
  mockCloudinary(t, uploaded);
  t.mock.method(Agency, "findOne", async () => existing);
  t.mock.method(Agency, "create", async () => assert.fail("Duplicate agency must not be created"));
  t.mock.method(User, "findByIdAndUpdate", async () => {
    roleUpdated = true;
  });
  const res = createResponse();
  await registerAgency(registrationRequest({ ownerAadhaar: file() }), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /already exists/i);
  assert.equal(uploaded.length, 0);
  assert.equal(roleUpdated, false);
});

test("user-role update failure rolls back the agency and uploaded private assets", async (t) => {
  const deletedAssets = [];
  let agencyDeleted = false;
  const uploaded = [];
  mockCloudinary(t, uploaded, deletedAssets);
  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data }));
  t.mock.method(Agency, "deleteOne", async () => {
    agencyDeleted = true;
  });
  t.mock.method(User, "findByIdAndUpdate", async (_id, update) => {
    if (update.role === "agency") throw new Error("role update failed");
    return {};
  });

  const res = createResponse();
  await registerAgency(registrationRequest({ ownerAadhaar: file() }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(agencyDeleted, true);
  assert.deepEqual(deletedAssets, uploaded.map((asset) => asset.public_id));
});

test("Cloudinary failure cleans earlier uploads before creating an agency", async (t) => {
  const uploaded = [];
  const deletedAssets = [];
  mockCloudinary(t, uploaded, deletedAssets, async () => {
    if (uploaded.length === 1) throw new Error("Cloudinary upload failed");
    const asset = {
      secure_url: "https://res.cloudinary.com/test/image/upload/private-first.png",
      public_id: "loadbalbin_kyc/registration-first",
      resource_type: "image",
      format: "png"
    };
    uploaded.push(asset);
    return asset;
  });
  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async () => assert.fail("Agency must not be created"));

  const res = createResponse();
  await registerAgency(registrationRequest({ ownerAadhaar: file(), taxId: file() }), res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(deletedAssets, ["loadbalbin_kyc/registration-first"]);
});

test("database creation failure cleans uploaded assets and does not change the user role", async (t) => {
  const uploaded = [];
  const deletedAssets = [];
  let roleUpdated = false;
  mockCloudinary(t, uploaded, deletedAssets);
  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async () => {
    throw new Error("database create failed");
  });
  t.mock.method(User, "findByIdAndUpdate", async () => {
    roleUpdated = true;
    return {};
  });

  const res = createResponse();
  await registerAgency(registrationRequest({ ownerAadhaar: file() }), res);

  assert.equal(res.statusCode, 500);
  assert.equal(roleUpdated, false);
  assert.deepEqual(deletedAssets, uploaded.map((asset) => asset.public_id));
});
