import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import adminDriverRoutes from "../src/routes/adminDriverRoutes.js";
import documentRoutes from "../src/routes/documentRoutes.js";
import { generateToken } from "../src/utils/generateToken.js";

const agencyAId = new mongoose.Types.ObjectId();
const agencyBId = new mongoose.Types.ObjectId();
const agencyOwnerId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const driverId = new mongoose.Types.ObjectId();

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/documents", documentRoutes);
  app.use("/api/admin/drivers", adminDriverRoutes);
  return app;
};

const createDriver = (overrides = {}) => {
  const documentOverrides = overrides.documents || {};
  return {
    _id: driverId,
    user: otherUserId,
    agency: agencyAId,
    ...overrides,
    documents: {
      idProof: {
        publicId: "loadbalbin_kyc/driver-id-proof",
        resourceType: "image",
        format: "png",
        status: "pending",
        submittedAt: new Date("2026-10-01T10:00:00.000Z"),
        ...documentOverrides.idProof
      },
      drivingLicense: {
        publicId: "loadbalbin_kyc/driver-license",
        resourceType: "raw",
        format: "pdf",
        status: "pending",
        submittedAt: new Date("2026-10-02T10:00:00.000Z"),
        ...documentOverrides.drivingLicense
      }
    }
  };
};

const setupRequest = (t, {
  role = "agency",
  userId = role === "agency" ? agencyOwnerId : new mongoose.Types.ObjectId(),
  driver = createDriver(),
  agencyOwned = true
} = {}) => {
  const user = {
    _id: userId,
    role,
    isActive: true
  };
  t.mock.method(User, "findById", () => ({
    select: async () => user
  }));
  t.mock.method(Driver, "findById", async () => driver);
  t.mock.method(Agency, "findOne", (query) => ({
    select: () => ({
      lean: async () => (
        agencyOwned &&
        String(query._id) === String(driver.agency) &&
        String(query.owner) === String(agencyOwnerId)
          ? { _id: driver.agency }
          : null
      )
    })
  }));

  return {
    app: createApp(),
    token: generateToken({ userId: user._id, role: user.role })
  };
};

test("Agency Owner can view both private personal KYC documents and their actual review status", async (t) => {
  const driver = createDriver({
    documents: {
      idProof: { status: "pending" },
      drivingLicense: {
        status: "rejected",
        rejectionReason: "The licence scan is not readable."
      }
    }
  });
  const { app, token } = setupRequest(t, { driver });

  const aadhaar = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(aadhaar.status, 200);
  assert.equal(aadhaar.body.data.document.status, "pending");
  assert.match(aadhaar.body.data.document.viewUrl, /^https:\/\/.*cloudinary\.com/);
  assert.equal(aadhaar.body.data.document.expiresInSeconds, 300);
  assert.equal("publicId" in aadhaar.body.data.document, false);
  assert.equal("url" in aadhaar.body.data.document, false);

  const licence = await request(app)
    .get(`/api/documents/driver/${driverId}/drivingLicense`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(licence.status, 200);
  assert.equal(licence.body.data.document.status, "rejected");
  assert.equal(licence.body.data.document.rejectionReason, "The licence scan is not readable.");
  assert.equal(licence.body.data.document.format, "pdf");
});

test("Approved personal KYC is previewable with its actual saved status", async (t) => {
  const driver = createDriver({
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  });
  const { app, token } = setupRequest(t, { driver });

  for (const docType of ["idProof", "drivingLicense"]) {
    const response = await request(app)
      .get(`/api/documents/driver/${driverId}/${docType}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.document.status, "approved");
  }
});

test("A fresh authenticated request supplies a renewed short-lived preview link", async (t) => {
  const { app, token } = setupRequest(t);
  const path = `/api/documents/driver/${driverId}/idProof`;
  const first = await request(app).get(path).set("Authorization", `Bearer ${token}`);
  const refreshed = await request(app).get(path).set("Authorization", `Bearer ${token}`);

  assert.equal(first.status, 200);
  assert.equal(refreshed.status, 200);
  assert.equal(first.body.data.document.expiresInSeconds, 300);
  assert.equal(refreshed.body.data.document.expiresInSeconds, 300);
  assert.match(refreshed.body.data.document.viewUrl, /^https:\/\/.*cloudinary\.com/);
});

test("Agency Owners cannot view other-agency or independent Driver documents", async (t) => {
  const driver = createDriver({ agency: agencyBId });
  const { app, token } = setupRequest(t, { driver, agencyOwned: false });
  const deniedOtherAgency = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deniedOtherAgency.status, 403);

  driver.agency = null;
  const deniedIndependent = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deniedIndependent.status, 403);
});

test("Driver role cannot use Agency Owner access to another driver's documents", async (t) => {
  const { app, token } = setupRequest(t, { role: "driver" });
  const response = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
});

test("Driver can still preview their own private personal KYC documents", async (t) => {
  const { app, token } = setupRequest(t, {
    role: "driver",
    userId: otherUserId
  });
  const response = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.document.status, "pending");
});

test("Missing or non-private legacy URLs do not produce a preview", async (t) => {
  const driver = createDriver({
    documents: {
      idProof: { status: "not_uploaded", publicId: "", url: "" },
      drivingLicense: {
        status: "pending",
        publicId: "",
        url: "https://public.example.test/permanent-driver-license.pdf"
      }
    }
  });
  const { app, token } = setupRequest(t, { driver });

  const missing = await request(app)
    .get(`/api/documents/driver/${driverId}/idProof`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);

  const legacyPublic = await request(app)
    .get(`/api/documents/driver/${driverId}/drivingLicense`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(legacyPublic.status, 404);
  assert.doesNotMatch(JSON.stringify(legacyPublic.body), /public\.example\.test/);
});

test("Agency Owners cannot approve or reject Driver KYC documents", async (t) => {
  const { app, token } = setupRequest(t);
  for (const action of ["approve", "reject"]) {
    const response = await request(app)
      .patch(`/api/admin/drivers/${driverId}/documents/idProof/${action}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Not authorized" });
    assert.equal(response.status, 403);
  }
});
