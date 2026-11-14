import assert from "node:assert/strict";
import test from "node:test";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import Driver from "../src/models/Driver.js";
import User from "../src/models/User.js";
import { uploadImage } from "../src/controllers/uploadController.js";

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

const profilePng = () => ({
  mimetype: "image/png",
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
});

const configureCloudinary = (t) => {
  const previous = { ...env.cloudinary };
  Object.assign(env.cloudinary, {
    cloudName: "test-cloud",
    apiKey: "test-key",
    apiSecret: "test-secret"
  });
  t.after(() => Object.assign(env.cloudinary, previous));
};

test("driver profile photo upload and replacement update only the authenticated driver", async (t) => {
  configureCloudinary(t);
  const userId = "driver-user-id";
  const otherUserId = "untrusted-body-user-id";
  const userUpdates = [];
  const driverUpdates = [];
  let uploadNumber = 0;

  t.mock.method(cloudinary.uploader, "upload", async (_dataUri, options) => {
    uploadNumber += 1;
    assert.equal(options.folder, "loadbalbin_profiles");
    return {
      secure_url: `https://res.cloudinary.com/test/profile-${uploadNumber}.png`,
      public_id: `loadbalbin_profiles/profile-${uploadNumber}`,
      resource_type: "image",
      format: "png"
    };
  });
  t.mock.method(User, "findByIdAndUpdate", async (id, update) => {
    userUpdates.push({ id, update });
    return { profileImage: update.profileImage };
  });
  t.mock.method(Driver, "findOneAndUpdate", async (filter, update) => {
    driverUpdates.push({ filter, update });
    return { profileImage: update.profileImage };
  });

  for (let index = 0; index < 2; index += 1) {
    const res = response();
    await uploadImage({
      file: profilePng(),
      body: { purpose: "profile", userId: otherUserId },
      user: { _id: userId, role: "driver" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.profileImage, `https://res.cloudinary.com/test/profile-${index + 1}.png`);
  }

  assert.equal(userUpdates.length, 2);
  assert.equal(driverUpdates.length, 2);
  assert.ok(userUpdates.every(({ id }) => id === userId));
  assert.ok(driverUpdates.every(({ filter }) => filter.user === userId));
  assert.equal(userUpdates[0].update.profileImage, "https://res.cloudinary.com/test/profile-1.png");
  assert.equal(userUpdates[1].update.profileImage, "https://res.cloudinary.com/test/profile-2.png");
  assert.notEqual(userUpdates[0].update.profileImage, userUpdates[1].update.profileImage);
});

test("agency-owner profile image upload updates the authenticated User without changing a Driver", async (t) => {
  configureCloudinary(t);
  const userId = "agency-owner-user-id";
  const userUpdates = [];
  t.mock.method(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://res.cloudinary.com/test/agency-owner.png",
    public_id: "loadbalbin_profiles/agency-owner",
    resource_type: "image",
    format: "png"
  }));
  t.mock.method(User, "findByIdAndUpdate", async (id, update) => {
    userUpdates.push({ id, update });
    return { profileImage: update.profileImage };
  });
  const driverUpdate = t.mock.method(Driver, "findOneAndUpdate", async () => {
    throw new Error("Agency owner upload must not update a Driver record");
  });

  const res = response();
  await uploadImage({
    file: profilePng(),
    body: { purpose: "profile" },
    user: { _id: userId, role: "agency" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(userUpdates[0].id, userId);
  assert.equal(res.body.profileImage, "https://res.cloudinary.com/test/agency-owner.png");
  assert.equal(driverUpdate.mock.calls.length, 0);
});

test("JPG profile photos are uploaded with a normalized JPEG MIME type", async (t) => {
  configureCloudinary(t);
  let uploadedDataUri = "";
  t.mock.method(cloudinary.uploader, "upload", async (dataUri) => {
    uploadedDataUri = dataUri;
    return {
      secure_url: "https://res.cloudinary.com/test/jpg-photo.jpg",
      public_id: "loadbalbin_profiles/jpg-photo",
      resource_type: "image",
      format: "jpg"
    };
  });
  t.mock.method(User, "findByIdAndUpdate", async () => ({ profileImage: "saved" }));

  const res = response();
  await uploadImage({
    file: {
      mimetype: "image/jpg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00])
    },
    body: { purpose: "profile" },
    user: { _id: "driver-user-id", role: "customer" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.match(uploadedDataUri, /^data:image\/jpeg;base64,/);
});

test("profile image upload rejects unsupported and mislabeled image files", async (t) => {
  const upload = t.mock.method(cloudinary.uploader, "upload", async () => {
    throw new Error("Unsupported images must never reach storage");
  });
  for (const file of [
    { mimetype: "image/webp", buffer: profilePng().buffer },
    { mimetype: "image/png", buffer: Buffer.from("not a PNG") }
  ]) {
    const res = response();
    await uploadImage({
      file,
      body: { purpose: "profile" },
      user: { _id: "driver-user-id", role: "driver" }
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /JPG, JPEG, or PNG/);
  }
  assert.equal(upload.mock.calls.length, 0);
});

test("Cloudinary upload failure leaves the stored profile photo untouched", async (t) => {
  configureCloudinary(t);
  const upload = t.mock.method(cloudinary.uploader, "upload", async () => {
    throw new Error("Upload unavailable");
  });
  const userUpdate = t.mock.method(User, "findByIdAndUpdate", async () => {
    throw new Error("The profile must not be updated after a failed upload");
  });

  const res = response();
  await uploadImage({
    file: profilePng(),
    body: { purpose: "profile" },
    user: { _id: "driver-user-id", role: "driver" }
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(upload.mock.calls.length, 1);
  assert.equal(userUpdate.mock.calls.length, 0);
});
