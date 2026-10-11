import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import { generateToken } from "../src/utils/generateToken.js";

describe("Profile Photo Upload & Profile API", () => {
  let customerToken, customerId;
  const testPhone = "+919988776655";

  // 1x1 transparent PNG buffer
  const validImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/loadbalbin_test");
    }
    await User.deleteMany({ phone: testPhone });

    const customer = await User.create({
      name: "Test Customer",
      phone: testPhone,
      email: "testcustomer@loadbalbin.com",
      role: "customer",
      password: "password123",
      profileImage: ""
    });

    customerId = customer._id;
    customerToken = generateToken({ userId: customer._id, role: customer.role });
  });

  after(async () => {
    await User.deleteMany({ phone: testPhone });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("1. Updates profile details (name, email) without an image", async () => {
    const res = await request(app)
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Updated Name",
        email: "updated@loadbalbin.com"
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, "Updated Name");
    assert.equal(res.body.data.email, "updated@loadbalbin.com");
    assert.equal(res.body.data.profileImage, "");
  });

  it("2. Rejects upload when unauthenticated (401)", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .attach("image", validImageBuffer, "avatar.png");

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it("3. Rejects upload when no image file is provided (400)", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "No image file provided");
  });

  it("4. Rejects upload when file is attached with incorrect field name (400)", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${customerToken}`)
      .attach("wrongField", validImageBuffer, "avatar.png");

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Expected 'image'/);
  });

  it("5. Rejects invalid file MIME type (400)", async () => {
    const textBuffer = Buffer.from("This is a plain text file, not an image.", "utf-8");
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${customerToken}`)
      .attach("image", textBuffer, "document.txt");

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Invalid file type/);
  });

  it("6. Rejects file exceeding 5MB limit (400)", async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${customerToken}`)
      .attach("image", largeBuffer, { filename: "large.jpg", contentType: "image/jpeg" });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /5MB/);
  });

  let uploadedUrl = "";

  it("7. Successfully uploads a valid image and updates user profile in database", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${customerToken}`)
      .attach("image", validImageBuffer, "avatar.png");

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.imageUrl, "Expected imageUrl in response");
    assert.match(res.body.imageUrl, /^https:\/\/res\.cloudinary\.com\//);

    uploadedUrl = res.body.imageUrl;

    // Verify persisted directly in database
    const userInDb = await User.findById(customerId);
    assert.equal(userInDb.profileImage, uploadedUrl);
  });

  it("8. Reloading profile returns the uploaded image URL", async () => {
    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.profileImage, uploadedUrl);
    assert.equal(res.body.data.name, "Updated Name");
  });

  it("9. Updating profile details without touching image preserves the saved profileImage", async () => {
    const res = await request(app)
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Final Name"
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, "Final Name");
    assert.equal(res.body.data.profileImage, uploadedUrl);
  });
});
