import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Booking from "../src/models/Booking.js";
import Driver from "../src/models/Driver.js";
import Agency from "../src/models/Agency.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import {
  uploadDeliveryProof,
  getDeliveryProof
} from "../src/controllers/bookingController.js";

const createResponse = () => ({
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

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
]);

test("delivery proof upload requires a valid image file", async () => {
  const driverUserId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const res = createResponse();

  await uploadDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /delivery proof image is required/i);
});

test("delivery proof upload rejects files exceeding 5MB or invalid types", async () => {
  const driverUserId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  // Invalid type (text/plain)
  const invalidTypeRes = createResponse();
  await uploadDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" },
    file: {
      mimetype: "text/plain",
      size: 1024,
      buffer: Buffer.from("plain text")
    }
  }, invalidTypeRes);
  assert.equal(invalidTypeRes.statusCode, 400);
  assert.match(invalidTypeRes.body.message, /Invalid file type/i);

  // File exceeding 5MB
  const oversizeRes = createResponse();
  await uploadDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" },
    file: {
      mimetype: "image/png",
      size: 6 * 1024 * 1024,
      buffer: pngBuffer
    }
  }, oversizeRes);
  assert.equal(oversizeRes.statusCode, 400);
  assert.match(oversizeRes.body.message, /maximum limit of 5MB/i);
});

test("delivery proof upload restricts to the assigned driver and does not auto-verify delivery", async (t) => {
  const driverUserId = new mongoose.Types.ObjectId();
  const otherDriverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const driver = { _id: driverId, user: driverUserId };
  const booking = {
    _id: bookingId,
    bookingNumber: "BOOKING-TEST-PROOF",
    driver: driverId,
    bookingStatus: "in-progress",
    deliveryProofUrl: "",
    deliveryProof: null,
    markModified() {},
    async save() { return this; }
  };

  t.mock.method(Driver, "findOne", async ({ user }) => {
    if (String(user) === String(driverUserId)) return driver;
    return null;
  });

  t.mock.method(Booking, "findOne", async ({ _id, driver: assignedDriverId }) => {
    if (String(_id) === String(bookingId) && String(assignedDriverId) === String(driverId)) {
      return booking;
    }
    return null;
  });

  t.mock.method(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/proof-123.jpg",
    public_id: "loadbalbin_delivery_proofs/proof-123"
  }));

  const originalKey = env.cloudinary.apiKey;
  const originalSecret = env.cloudinary.apiSecret;
  const originalName = env.cloudinary.cloudName;
  env.cloudinary.apiKey = "mock-key";
  env.cloudinary.apiSecret = "mock-secret";
  env.cloudinary.cloudName = "mock-cloud";

  // Other driver forbidden
  const unauthorizedRes = createResponse();
  await uploadDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: otherDriverUserId, role: "driver" },
    file: {
      mimetype: "image/png",
      size: 1024,
      buffer: pngBuffer
    }
  }, unauthorizedRes);
  assert.equal(unauthorizedRes.statusCode, 404); // Driver profile not found for other user

  // Assigned driver succeeds
  const successRes = createResponse();
  await uploadDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" },
    file: {
      mimetype: "image/png",
      size: 1024,
      buffer: pngBuffer
    }
  }, successRes);

  assert.equal(successRes.statusCode, 201);
  assert.equal(booking.deliveryProofUrl, "https://res.cloudinary.com/demo/image/upload/proof-123.jpg");
  assert.equal(booking.deliveryProof.publicId, "loadbalbin_delivery_proofs/proof-123");
  // CRITICAL: bookingStatus must NOT be altered solely by uploading proof!
  assert.equal(booking.bookingStatus, "in-progress");

  env.cloudinary.apiKey = originalKey;
  env.cloudinary.apiSecret = originalSecret;
  env.cloudinary.cloudName = originalName;
});

test("getDeliveryProof enforces participant authorization", async (t) => {
  const customerId = new mongoose.Types.ObjectId();
  const otherCustomerId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const booking = {
    _id: bookingId,
    bookingNumber: "BOOKING-TEST-PROOF",
    customer: customerId,
    driver: driverId,
    deliveryProofUrl: "https://res.cloudinary.com/demo/image/upload/proof-123.jpg",
    deliveryProof: {
      url: "https://res.cloudinary.com/demo/image/upload/proof-123.jpg",
      publicId: "loadbalbin_delivery_proofs/proof-123",
      uploadedAt: new Date()
    },
    unloadedAt: new Date()
  };

  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Driver, "findOne", async () => ({ _id: driverId }));

  // Customer owner can view
  const customerRes = createResponse();
  await getDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: customerId, role: "customer" }
  }, customerRes);
  assert.equal(customerRes.statusCode, 200);
  assert.equal(customerRes.body.data.deliveryProofUrl, booking.deliveryProofUrl);

  // Admin can view
  const adminRes = createResponse();
  await getDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: adminId, role: "admin" }
  }, adminRes);
  assert.equal(adminRes.statusCode, 200);

  // Assigned driver can view
  const driverRes = createResponse();
  await getDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: driverUserId, role: "driver" }
  }, driverRes);
  assert.equal(driverRes.statusCode, 200);

  // Unrelated customer is rejected with 403
  const unauthorizedRes = createResponse();
  await getDeliveryProof({
    params: { id: bookingId.toString() },
    user: { _id: otherCustomerId, role: "customer" }
  }, unauthorizedRes);
  assert.equal(unauthorizedRes.statusCode, 403);
});
