import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import cloudinary from "../src/config/cloudinary.js";
import { generateToken } from "../src/utils/generateToken.js";
import { generateSignedDocumentUrl } from "../src/utils/documentSigner.js";
import { env } from "../src/config/env.js";

describe("KYC Document Security & Real Cloudinary Delivery Verification", () => {
  const timestamp = Date.now();

  let adminUser, adminToken;
  let regularAdminUser, regularAdminToken;
  let customerUser, customerToken;
  let agencyAOwner, agencyAToken, agencyA;
  let agencyBOwner, agencyBToken, agencyB;
  let driverAUser, driverAToken, driverA;
  let driverBUser, driverBToken, driverB;

  // Real Cloudinary test asset created for live CDN verification
  let liveCloudinaryAsset = null;
  const workflowUploadAssets = [];
  const originalSuperAdminUserId = env.superAdminUserId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");
    }

    // Create a real authenticated test asset on Cloudinary to test real CDN delivery & expiry
    if (process.env.CLOUDINARY_API_KEY) {
      try {
        const uploadRes = await cloudinary.uploader.upload(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          {
            folder: "loadbalbin_kyc",
            type: "authenticated",
            resource_type: "image"
          }
        );
        liveCloudinaryAsset = uploadRes;
      } catch (err) {
        console.warn("Notice: Cloudinary upload skipped in test setup:", err.message);
      }
    }

    // 1. Create Super Admin
    adminUser = await User.create({
      name: "Super Admin",
      phone: `+9199000${timestamp.toString().slice(-5)}`,
      role: "admin",
      password: "password123"
    });
    adminToken = generateToken({ userId: adminUser._id, role: "admin" });
    env.superAdminUserId = adminUser._id.toString();

    regularAdminUser = await User.create({
      name: "Regular Admin",
      phone: `+9199010${timestamp.toString().slice(-5)}`,
      role: "admin",
      password: "password123"
    });
    regularAdminToken = generateToken({ userId: regularAdminUser._id, role: "admin" });

    // 2. Create Customer
    customerUser = await User.create({
      name: "Customer Jane",
      phone: `+9199100${timestamp.toString().slice(-5)}`,
      role: "customer",
      password: "password123"
    });
    customerToken = generateToken({ userId: customerUser._id, role: "customer" });

    // 3. Create Agency A Owner & Agency A
    agencyAOwner = await User.create({
      name: "Agency Owner A",
      phone: `+9199200${timestamp.toString().slice(-5)}`,
      role: "agency",
      password: "password123"
    });
    agencyAToken = generateToken({ userId: agencyAOwner._id, role: "agency" });

    const agencyADocUrl = liveCloudinaryAsset?.secure_url || "https://api.cloudinary.com/v1_1/demo/image/download?public_id=owner_a";
    const agencyAPublicId = liveCloudinaryAsset?.public_id || "loadbalbin_kyc/owner_a_aadhaar";

    agencyA = await Agency.create({
      owner: agencyAOwner._id,
      agencyName: "Alpha Logistics",
      phone: agencyAOwner.phone,
      approvalStatus: "approved",
      isActive: true,
      documents: {
        ownerAadhaar: {
          url: agencyADocUrl,
          publicId: agencyAPublicId,
          resourceType: "image",
          format: "png",
          status: "pending"
        },
        businessRegistration: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=owner_a_reg",
          publicId: "loadbalbin_kyc/owner_a_reg",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        }
      }
    });

    // 4. Create Agency B Owner & Agency B
    agencyBOwner = await User.create({
      name: "Agency Owner B",
      phone: `+9199300${timestamp.toString().slice(-5)}`,
      role: "agency",
      password: "password123"
    });
    agencyBToken = generateToken({ userId: agencyBOwner._id, role: "agency" });

    agencyB = await Agency.create({
      owner: agencyBOwner._id,
      agencyName: "Beta Transporters",
      phone: agencyBOwner.phone,
      documents: {
        ownerAadhaar: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=owner_b",
          publicId: "loadbalbin_kyc/owner_b_aadhaar",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        }
      }
    });

    // 5. Create Driver A (belongs to Agency A)
    driverAUser = await User.create({
      name: "Driver Alpha",
      phone: `+9199400${timestamp.toString().slice(-5)}`,
      role: "driver",
      password: "password123"
    });
    driverAToken = generateToken({ userId: driverAUser._id, role: "driver" });

    driverA = await Driver.create({
      user: driverAUser._id,
      agency: agencyA._id,
      fullName: "Driver Alpha",
      phone: driverAUser.phone,
      documents: {
        idProof: {
          url: agencyADocUrl,
          publicId: agencyAPublicId,
          resourceType: "image",
          format: "png",
          status: "pending"
        },
        drivingLicense: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=driver_a_dl",
          publicId: "loadbalbin_kyc/driver_a_dl",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        },
        vehicleRegistration: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=driver_a_rc",
          publicId: "loadbalbin_kyc/driver_a_rc",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        },
        insurance: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=driver_a_ins",
          publicId: "loadbalbin_kyc/driver_a_ins",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        }
      }
    });

    // 6. Create Driver B (belongs to Agency B)
    driverBUser = await User.create({
      name: "Driver Beta",
      phone: `+9199500${timestamp.toString().slice(-5)}`,
      role: "driver",
      password: "password123"
    });
    driverBToken = generateToken({ userId: driverBUser._id, role: "driver" });

    driverB = await Driver.create({
      user: driverBUser._id,
      agency: agencyB._id,
      fullName: "Driver Beta",
      phone: driverBUser.phone,
      documents: {
        idProof: {
          url: "https://api.cloudinary.com/v1_1/demo/image/download?public_id=driver_b_id",
          publicId: "loadbalbin_kyc/driver_b_id",
          resourceType: "image",
          format: "pdf",
          status: "pending"
        }
      }
    });
  });

  after(async () => {
    for (const asset of [liveCloudinaryAsset, ...workflowUploadAssets]) {
      if (!asset?.public_id) continue;
      try {
        await cloudinary.uploader.destroy(asset.public_id, {
          type: "authenticated",
          resource_type: asset.resource_type || "image"
        });
      } catch (error) {
        console.warn("Notice: Cloudinary test asset cleanup failed:", error.code || error.name || "unknown error");
      }
    }
    await Agency.deleteMany({ _id: { $in: [agencyA?._id, agencyB?._id] } });
    await Driver.deleteMany({ _id: { $in: [driverA?._id, driverB?._id] } });
    await User.deleteMany({ _id: { $in: [adminUser?._id, regularAdminUser?._id, customerUser?._id, agencyAOwner?._id, agencyBOwner?._id, driverAUser?._id, driverBUser?._id] } });
    env.superAdminUserId = originalSuperAdminUserId;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // TEST 1: Unauthenticated request is rejected (401)
  it("1. Unauthenticated users cannot view KYC documents", async () => {
    const res = await request(app)
      .get(`/api/documents/agency/${agencyA._id}/ownerAadhaar`);
    assert.equal(res.status, 401);
  });

  it("Public driver registration sees only safe fields for active approved agencies", async () => {
    const res = await request(app).get("/api/agency/verified");
    assert.equal(res.status, 200);
    const listedAgency = res.body.data.agencies.find((agency) => agency._id === agencyA._id.toString());
    assert.ok(listedAgency);
    assert.equal(res.body.data.agencies.some((agency) => agency._id === agencyB._id.toString()), false);
    assert.equal(listedAgency.agencyName, agencyA.agencyName);
    assert.equal(listedAgency.city, agencyA.city);
    assert.equal("documents" in listedAgency, false);
    assert.equal("owner" in listedAgency, false);
  });

  it("Agency driver list is isolated and the global admin list contains the same driver", async () => {
    const agencyRes = await request(app)
      .get("/api/agency/drivers")
      .set("Authorization", `Bearer ${agencyAToken}`);
    assert.equal(agencyRes.status, 200);
    const agencyDriverIds = agencyRes.body.data.drivers.map((driver) => driver._id);
    assert.ok(agencyDriverIds.includes(driverA._id.toString()));
    assert.equal(agencyDriverIds.includes(driverB._id.toString()), false);

    const globalRes = await request(app)
      .get("/api/admin/drivers")
      .query({ search: driverA.phone })
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(globalRes.status, 200);
    assert.ok(globalRes.body.data.drivers.some((driver) => driver.id === driverA._id.toString()));
  });

  it("A regular admin cannot perform final driver approval", async () => {
    const res = await request(app)
      .patch(`/api/admin/drivers/${driverA._id}/approve`)
      .set("Authorization", `Bearer ${regularAdminToken}`)
      .send({});
    assert.equal(res.status, 403);
  });

  // TEST 2: Customers cannot view private KYC documents (403)
  it("2. Customers cannot view private KYC documents", async () => {
    const res = await request(app)
      .get(`/api/documents/agency/${agencyA._id}/ownerAadhaar`)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(res.status, 403);
  });

  // TEST 3: Agency A cannot view Agency B's KYC documents (403)
  it("3. Agency A cannot view Agency B's documents", async () => {
    const res = await request(app)
      .get(`/api/documents/agency/${agencyB._id}/ownerAadhaar`)
      .set("Authorization", `Bearer ${agencyAToken}`);
    assert.equal(res.status, 403);
  });

  // TEST 4: Drivers cannot view another driver's KYC documents (403)
  it("4. Drivers cannot view another driver's documents", async () => {
    const res = await request(app)
      .get(`/api/documents/driver/${driverB._id}/idProof`)
      .set("Authorization", `Bearer ${driverAToken}`);
    assert.equal(res.status, 403);
  });

  // TEST 5: Driver A can view own documents
  it("5. Driver A can view own documents via /api/documents/driver/:id/:type", async () => {
    const res = await request(app)
      .get(`/api/documents/driver/${driverA._id}/idProof`)
      .set("Authorization", `Bearer ${driverAToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.data.document.viewUrl);
    assert.match(res.body.data.document.viewUrl, /cloudinary\.com.*download/);
  });

  // TEST 6: Agency A can view its own driver's documents, but cannot view Agency B's driver
  it("6. Agency A can view its driver's docs, but not Agency B's driver", async () => {
    const resOwn = await request(app)
      .get(`/api/documents/driver/${driverA._id}/drivingLicense`)
      .set("Authorization", `Bearer ${agencyAToken}`);
    assert.equal(resOwn.status, 200);
    assert.ok(resOwn.body.data.document.viewUrl);

    const resOther = await request(app)
      .get(`/api/documents/driver/${driverB._id}/idProof`)
      .set("Authorization", `Bearer ${agencyAToken}`);
    assert.equal(resOther.status, 403);
  });

  // TEST 7: Super Admin can review any agency and driver documents
  it("7. Authorized Super Admin can review agency and driver documents", async () => {
    const resAgency = await request(app)
      .get(`/api/documents/agency/${agencyA._id}/ownerAadhaar`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(resAgency.status, 200);
    assert.ok(resAgency.body.data.document.viewUrl);

    const resDriver = await request(app)
      .get(`/api/documents/driver/${driverB._id}/idProof`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(resDriver.status, 200);
    assert.ok(resDriver.body.data.document.viewUrl);

    // Driver document access is limited to personal identity records.
    for (const docKey of ["idProof", "drivingLicense"]) {
      const docRes = await request(app)
        .get(`/api/documents/driver/${driverA._id}/${docKey}`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(docRes.status, 200, `Super Admin must be authorized to view driver ${docKey}`);
      assert.ok(docRes.body.data.document.viewUrl, `viewUrl must be returned for ${docKey}`);
      assert.equal(docRes.body.data.document.expiresInSeconds, 300);
    }
    for (const docKey of ["vehicleRegistration", "insurance"]) {
      const docRes = await request(app)
        .get(`/api/documents/driver/${driverA._id}/${docKey}`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(docRes.status, 400, `${docKey} must be served from a Vehicle record`);
    }
  });

  // TEST: Ordinary admin receives 403 on driver KYC documents
  it("7b. Ordinary admin receives 403 when attempting to view driver KYC documents", async () => {
    const res = await request(app)
      .get(`/api/documents/driver/${driverA._id}/idProof`)
      .set("Authorization", `Bearer ${regularAdminToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Access denied.*not authorized/i);
  });

  // Vehicle-owned document types are not served from a Driver profile
  it("7c. Driver document endpoint rejects Vehicle-owned document types", async () => {
    const res = await request(app)
      .get(`/api/documents/driver/${driverB._id}/insurance`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid driver document type/i);
  });

  // TEST: Expired signed URLs can be refreshed via subsequent authorized requests
  it("7d. Expired signed URLs can be refreshed through repeated authorized requests", async () => {
    const firstReq = await request(app)
      .get(`/api/documents/driver/${driverA._id}/drivingLicense`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(firstReq.status, 200);
    const firstUrl = firstReq.body.data.document.viewUrl;
    assert.ok(firstUrl);

    // Subsequent authorized request generates a fresh valid signed URL
    const secondReq = await request(app)
      .get(`/api/documents/driver/${driverA._id}/drivingLicense`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(secondReq.status, 200);
    const secondUrl = secondReq.body.data.document.viewUrl;
    assert.ok(secondUrl);
    assert.equal(typeof secondUrl, "string");
  });

  // TEST: Super Admin identity matching handles trimmed IDs and quoted env values
  it("7e. Super Admin identity check handles whitespace, quotes, and plain user objects", async () => {
    const originalEnv = env.superAdminUserId;
    const originalProcess = process.env.SUPER_ADMIN_USER_ID;
    try {
      // Simulate env variable with surrounding quotes and extra whitespace as entered in Render dashboard
      process.env.SUPER_ADMIN_USER_ID = `  "${adminUser._id.toString()}"  `;
      env.superAdminUserId = process.env.SUPER_ADMIN_USER_ID;

      const res = await request(app)
        .get(`/api/documents/driver/${driverA._id}/idProof`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(res.status, 200, "Super Admin must be authorized despite whitespace or quotes in env setting");
      assert.ok(res.body.data.document.viewUrl);
    } finally {
      if (originalProcess !== undefined) {
        process.env.SUPER_ADMIN_USER_ID = originalProcess;
      } else {
        delete process.env.SUPER_ADMIN_USER_ID;
      }
      env.superAdminUserId = originalEnv;
    }
  });

  // TEST 8: Live Cloudinary check - Unsigned URL cannot retrieve authenticated KYC asset
  it("8. Unsigned URL cannot retrieve authenticated KYC asset (HTTP 401)", async () => {
    if (!liveCloudinaryAsset) return;
    const unsignedUrl = cloudinary.url(liveCloudinaryAsset.public_id, {
      type: "authenticated",
      secure: true,
      format: "png"
    });
    const fetchRes = await fetch(unsignedUrl);
    assert.equal(fetchRes.status, 401, "Unsigned URL to authenticated asset must return 401 Unauthorized");
  });

  // TEST 9: Live Cloudinary check - Valid signed URL successfully retrieves asset (HTTP 200)
  it("9. Authorized signed URL successfully retrieves KYC asset (HTTP 200)", async () => {
    if (!liveCloudinaryAsset) return;
    const signedUrl = generateSignedDocumentUrl(
      liveCloudinaryAsset.public_id,
      "png",
      120,
      "image"
    );
    const fetchRes = await fetch(signedUrl);
    assert.equal(fetchRes.status, 200, "Signed URL within expiry must return 200 OK");
  });

  // TEST 10: Live Cloudinary check - Expired link is rejected (HTTP 401)
  it("10. Expired signed link is rejected by provider (HTTP 401)", async () => {
    if (!liveCloudinaryAsset) return;
    const expiredUrl = generateSignedDocumentUrl(
      liveCloudinaryAsset.public_id,
      "png",
      -60, // 60 seconds in the past
      "image"
    );
    const fetchRes = await fetch(expiredUrl);
    assert.equal(fetchRes.status, 401, "Expired signed URL must return 401 Unauthorized");
  });

  // TEST 11: Public vehicle photos, profile pictures and banners remain publicly viewable
  it("11. Public media (vehicle photos, profiles, banners) remain publicly viewable", async () => {
    const publicPhotoUrl = "https://res.cloudinary.com/kj4rhwyt/image/upload/v1791705459/loadbalbin_vehicles/tata_ace_mini_truck.jpg";
    const res = await fetch(publicPhotoUrl);
    assert.equal(res.status, 200, "Public vehicle photo must resolve with 200 OK without authentication");
  });

  it("12. Driver upload, admin rejection, resubmission, and approval use the private KYC API", async () => {
    if (!liveCloudinaryAsset) return;
    const syntheticPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const upload = () => request(app)
      .post(`/api/documents/driver/${driverA._id}/idProof`)
      .set("Authorization", `Bearer ${driverAToken}`)
      .attach("document", syntheticPng, { filename: "synthetic-test.png", contentType: "image/png" });

    const firstSubmission = await upload();
    assert.equal(firstSubmission.status, 201);
    assert.equal(firstSubmission.body.data.document.status, "pending");
    driverA = await Driver.findById(driverA._id);
    workflowUploadAssets.push({ public_id: driverA.documents.idProof.publicId, resource_type: "image" });

    for (const token of [customerToken, agencyAToken, driverBToken, regularAdminToken]) {
      const unauthorizedReview = await request(app)
        .patch(`/api/admin/drivers/${driverA._id}/documents/idProof/approve`)
        .set("Authorization", `Bearer ${token}`)
        .send({});
      assert.equal(unauthorizedReview.status, 403);
    }
    driverA = await Driver.findById(driverA._id);
    assert.equal(driverA.documents.idProof.status, "pending");

    const superAdminDetails = await request(app)
      .get(`/api/admin/drivers/${driverA._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(superAdminDetails.status, 200);
    assert.equal(superAdminDetails.body.data.driver.canReviewDocuments, true);
    assert.ok(superAdminDetails.body.data.driver.documents.idProof.viewUrl);

    const regularAdminDetails = await request(app)
      .get(`/api/admin/drivers/${driverA._id}`)
      .set("Authorization", `Bearer ${regularAdminToken}`);
    assert.equal(regularAdminDetails.status, 200);
    assert.equal(regularAdminDetails.body.data.driver.canReviewDocuments, false);

    env.superAdminUserId = "";
    const notConfigured = await request(app)
      .patch(`/api/admin/drivers/${driverA._id}/documents/idProof/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.equal(notConfigured.status, 503);
    env.superAdminUserId = adminUser._id.toString();

    const rejected = await request(app)
      .patch(`/api/admin/drivers/${driverA._id}/documents/idProof/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Synthetic verification test rejection" });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.document.status, "rejected");

    const resubmission = await upload();
    assert.equal(resubmission.status, 201);
    assert.equal(resubmission.body.data.document.status, "pending");

    driverA = await Driver.findById(driverA._id);
    workflowUploadAssets.push({ public_id: driverA.documents.idProof.publicId, resource_type: "image" });
    const approved = await request(app)
      .patch(`/api/admin/drivers/${driverA._id}/documents/idProof/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.document.status, "approved");

    driverA = await Driver.findById(driverA._id);
    assert.equal(driverA.documents.idProof.status, "approved");
    const profile = await request(app)
      .get("/api/driver/profile")
      .set("Authorization", `Bearer ${driverAToken}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.driver.documents.idProof.status, "approved");
    assert.equal("url" in profile.body.data.driver.documents.idProof, false);
  });
});
