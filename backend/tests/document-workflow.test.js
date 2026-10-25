import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import express from "express";
import request from "supertest";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import { uploadDriverDocument, uploadVehicleDocument } from "../src/controllers/documentController.js";
import { reviewAdminDriverDocument } from "../src/controllers/adminDriverController.js";
import { assignVehicleDriver } from "../src/controllers/agencyController.js";
import { handleUploadSingle } from "../src/middleware/uploadMiddleware.js";

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

const pngFile = () => ({
  originalname: "identity.png",
  mimetype: "image/png",
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
});

const privateAsset = {
  public_id: "loadbalbin_kyc/test-document",
  secure_url: "https://private.example/test-document",
  resource_type: "image",
  format: "png"
};

const useTestCloudinaryConfig = (t) => {
  const previous = { ...env.cloudinary };
  Object.assign(env.cloudinary, {
    cloudName: "test-cloud",
    apiKey: "test-key",
    apiSecret: "test-secret"
  });
  t.after(() => Object.assign(env.cloudinary, previous));
};

test("driver upload stores private document metadata as pending", async (t) => {
  useTestCloudinaryConfig(t);
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let uploadOptions;
  const driver = {
    _id: driverId,
    user: userId,
    documents: {},
    markModified() {},
    async save() { return this; }
  };
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(cloudinary.uploader, "upload", async (_data, options) => {
    uploadOptions = options;
    return privateAsset;
  });

  const res = response();
  await uploadDriverDocument({
    params: { driverId: driverId.toString(), docType: "idProof" },
    user: { _id: userId, role: "driver" },
    file: pngFile()
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.document.status, "pending");
  assert.equal(driver.documents.idProof.uploadedBy.toString(), userId.toString());
  assert.ok(driver.documents.idProof.submittedAt instanceof Date);
  assert.equal(driver.documents.idProof.publicId, privateAsset.public_id);
  assert.equal(uploadOptions.type, "authenticated");
  assert.equal(uploadOptions.folder, "loadbalbin_kyc");
  assert.equal("url" in res.body.data.document, false);
});

test("driver upload rejects mismatched file signature and another driver's document", async (t) => {
  useTestCloudinaryConfig(t);
  const driverId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const driver = {
    _id: driverId,
    user: ownerId,
    documents: {},
    markModified() {},
    async save() { return this; }
  };
  t.mock.method(Driver, "findById", async () => driver);
  const upload = t.mock.method(cloudinary.uploader, "upload", async () => privateAsset);

  const invalidRes = response();
  await uploadDriverDocument({
    params: { driverId: driverId.toString(), docType: "idProof" },
    user: { _id: ownerId, role: "driver" },
    file: { ...pngFile(), buffer: Buffer.from("not an image") }
  }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);

  const unauthorizedRes = response();
  await uploadDriverDocument({
    params: { driverId: driverId.toString(), docType: "drivingLicense" },
    user: { _id: otherUserId, role: "driver" },
    file: pngFile()
  }, unauthorizedRes);
  assert.equal(unauthorizedRes.statusCode, 403);
  assert.equal(upload.mock.calls.length, 0);
});

test("admin rejection requires a reason and driver can resubmit into pending review", async (t) => {
  useTestCloudinaryConfig(t);
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const driver = {
    _id: driverId,
    user: userId,
    documents: {
      idProof: {
        publicId: privateAsset.public_id,
        url: privateAsset.secure_url,
        status: "pending",
        submittedAt: new Date()
      }
    },
    markModified() {},
    async save() { return this; }
  };
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(cloudinary.uploader, "upload", async () => privateAsset);

  const rejectRes = response();
  await reviewAdminDriverDocument({
    params: { id: driverId.toString(), docType: "idProof", action: "reject" },
    user: { _id: adminId }
  }, rejectRes);
  assert.equal(rejectRes.statusCode, 400);

  const reason = "Image is unreadable";
  const approvedRejection = response();
  await reviewAdminDriverDocument({
    params: { id: driverId.toString(), docType: "idProof", action: "reject" },
    body: { reason },
    user: { _id: adminId }
  }, approvedRejection);
  assert.equal(approvedRejection.statusCode, 200);
  assert.equal(driver.documents.idProof.status, "rejected");
  assert.equal(driver.documents.idProof.rejectionReason, reason);
  assert.equal(driver.documents.idProof.reviewedBy.toString(), adminId.toString());

  const uploadRes = response();
  await uploadDriverDocument({
    params: { driverId: driverId.toString(), docType: "idProof" },
    user: { _id: userId, role: "driver" },
    file: pngFile()
  }, uploadRes);
  assert.equal(uploadRes.statusCode, 201);
  assert.equal(driver.documents.idProof.status, "pending");
  assert.equal(driver.documents.idProof.rejectionReason, "");

  const approveRes = response();
  await reviewAdminDriverDocument({
    params: { id: driverId.toString(), docType: "idProof", action: "approve" },
    body: {},
    user: { _id: adminId }
  }, approveRes);
  assert.equal(approveRes.statusCode, 200);
  assert.equal(driver.documents.idProof.status, "approved");
});

test("upload middleware rejects disallowed types and files over 5 MB", async () => {
  const app = express();
  app.post("/upload", handleUploadSingle("document"), (req, res) => {
    res.status(200).json({ success: true });
  });

  const invalidType = await request(app)
    .post("/upload")
    .attach("document", Buffer.from("unsupported"), { filename: "document.txt", contentType: "text/plain" });
  assert.equal(invalidType.status, 400);

  const oversized = await request(app)
    .post("/upload")
    .attach("document", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "large.pdf", contentType: "application/pdf" });
  assert.equal(oversized.status, 400);
  assert.match(oversized.body.message, /5MB/);
});

test("agency cannot upload documents to another agency's vehicle", async (t) => {
  useTestCloudinaryConfig(t);
  const vehicleId = new mongoose.Types.ObjectId();
  const otherAgencyId = new mongoose.Types.ObjectId();
  const requestingAgencyId = new mongoose.Types.ObjectId();
  t.mock.method(Vehicle, "findById", async () => ({
    _id: vehicleId,
    agency: otherAgencyId,
    documents: {}
  }));
  t.mock.method(Agency, "findOne", () => ({
    select() {
      return { lean: async () => ({ _id: requestingAgencyId }) };
    }
  }));
  const upload = t.mock.method(cloudinary.uploader, "upload", async () => privateAsset);

  const res = response();
  await uploadVehicleDocument({
    params: { vehicleId: vehicleId.toString(), docType: "registration" },
    user: { _id: new mongoose.Types.ObjectId(), role: "agency" },
    file: pngFile()
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(upload.mock.calls.length, 0);
});

test("independent driver can upload documents for their own vehicle", async (t) => {
  useTestCloudinaryConfig(t);
  const vehicleId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const vehicle = {
    _id: vehicleId,
    driver: driverId,
    agency: null,
    documents: {},
    markModified() {},
    async save() { return this; }
  };
  t.mock.method(Driver, "findOne", () => ({
    select() {
      return { lean: async () => ({ _id: driverId, agency: null }) };
    }
  }));
  t.mock.method(Vehicle, "findById", async () => vehicle);
  t.mock.method(cloudinary.uploader, "upload", async () => privateAsset);

  const res = response();
  await uploadVehicleDocument({
    params: { vehicleId: vehicleId.toString(), docType: "registration" },
    user: { _id: userId, role: "driver" },
    file: pngFile()
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(vehicle.documents.registration.status, "pending");
  assert.equal(vehicle.documents.registration.uploadedBy.toString(), userId.toString());
});

test("failed database save cleans up the private uploaded asset", async (t) => {
  useTestCloudinaryConfig(t);
  const driverId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const driver = {
    _id: driverId,
    user: userId,
    documents: {},
    markModified() {},
    async save() { throw new Error("simulated database write failure"); }
  };
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(cloudinary.uploader, "upload", async () => privateAsset);
  const cleanup = t.mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));

  const res = response();
  await uploadDriverDocument({
    params: { driverId: driverId.toString(), docType: "idProof" },
    user: { _id: userId, role: "driver" },
    file: pngFile()
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(cleanup.mock.calls[0].arguments[0], privateAsset.public_id);
});

test("agency assignment requires approved driver identity and vehicle documents", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const driver = {
    _id: driverId,
    agency: agencyId,
    isActive: true,
    approvalStatus: "approved",
    documents: {
      idProof: { status: "pending" },
      drivingLicense: { status: "approved" }
    }
  };
  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    driver: null,
    isActive: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    },
    async save() { return this; }
  };
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Driver, "findOne", async () => driver);
  t.mock.method(Vehicle, "findOne", async () => vehicle);

  const pendingRes = response();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, pendingRes);
  assert.equal(pendingRes.statusCode, 403);
  assert.equal(vehicle.driver, null);

  driver.documents.idProof.status = "rejected";
  const rejectedRes = response();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, rejectedRes);
  assert.equal(rejectedRes.statusCode, 403);

  driver.documents.idProof.status = "approved";
  driver.approvalStatus = "suspended";
  const suspendedRes = response();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, suspendedRes);
  assert.equal(suspendedRes.statusCode, 403);
  driver.approvalStatus = "approved";

  vehicle.documents.insurance.status = "pending";
  const vehiclePendingRes = response();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, vehiclePendingRes);
  assert.equal(vehiclePendingRes.statusCode, 403);
  assert.equal(vehicle.driver, null);

  vehicle.documents.insurance.status = "approved";
  const eligibleRes = response();
  await assignVehicleDriver({
    params: { id: vehicleId.toString() },
    body: { driverId: driverId.toString() },
    user: { _id: ownerId }
  }, eligibleRes);
  assert.equal(eligibleRes.statusCode, 200);
  assert.equal(vehicle.driver.toString(), driverId.toString());
});
