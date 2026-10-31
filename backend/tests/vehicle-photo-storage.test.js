import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";
import {
  createAgencyVehicle,
  updateAgencyVehicle
} from "../src/controllers/agencyController.js";
import { createDriverVehicle } from "../src/controllers/vehicleController.js";
import {
  removeUploadedVehiclePhotoAssets,
  uploadVehiclePhotos,
  validateVehiclePhotoFiles
} from "../src/utils/vehiclePhotoStorage.js";

const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const photoFile = (buffer = pngBuffer, mimetype = "image/png") => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname: "vehicle.png"
});

const response = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const useCloudinaryTestConfig = (t) => {
  const previous = { ...env.cloudinary };
  Object.assign(env.cloudinary, {
    apiKey: "test-key",
    apiSecret: "test-secret",
    cloudName: "test-cloud"
  });
  t.after(() => Object.assign(env.cloudinary, previous));
};

test("vehicle photos accept zero through four optional image files", async (t) => {
  let uploadCount = 0;
  t.mock.method(cloudinary.uploader, "upload", async () => {
    uploadCount += 1;
    return {
      secure_url: `https://res.cloudinary.com/test/image/upload/vehicle-${uploadCount}.png`,
      public_id: `loadbalbin_vehicles/vehicle-${uploadCount}`
    };
  });
  useCloudinaryTestConfig(t);

  for (let count = 0; count <= 4; count += 1) {
    const uploaded = await uploadVehiclePhotos(Array.from({ length: count }, () => photoFile()));
    assert.equal(uploaded.length, count);
  }
  assert.equal(uploadCount, 10);
});

test("vehicle photo validation rejects a fifth file, mismatched image data, and files over 5 MB", () => {
  assert.throws(
    () => validateVehiclePhotoFiles(Array.from({ length: 5 }, () => photoFile())),
    /maximum of 4/i
  );
  assert.throws(() => validateVehiclePhotoFiles([photoFile(pngBuffer, "image/jpeg")]), /invalid vehicle photo/i);
  assert.throws(
    () => validateVehiclePhotoFiles([photoFile(Buffer.alloc(5 * 1024 * 1024 + 1))]),
    /5 MB or smaller/i
  );
  assert.throws(() => validateVehiclePhotoFiles([photoFile(pngBuffer, "image/gif")]), /invalid vehicle photo/i);
});

test("vehicle photo validation accepts JPG, JPEG, PNG, and WEBP signatures", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");
  assert.doesNotThrow(() => validateVehiclePhotoFiles([
    photoFile(jpeg, "image/jpeg"),
    photoFile(jpeg, "image/jpg"),
    photoFile(pngBuffer, "image/png"),
    photoFile(webp, "image/webp")
  ]));
  const maximumSizePng = Buffer.alloc(5 * 1024 * 1024);
  pngBuffer.copy(maximumSizePng);
  assert.doesNotThrow(() => validateVehiclePhotoFiles([photoFile(maximumSizePng)]));
});

test("vehicle photo upload cleans up earlier Cloudinary assets when a later upload fails", async (t) => {
  let uploadCount = 0;
  const removedAssets = [];
  t.mock.method(cloudinary.uploader, "upload", async () => {
    uploadCount += 1;
    if (uploadCount === 2) throw new Error("storage unavailable");
    return {
      secure_url: "https://res.cloudinary.com/test/image/upload/vehicle.png",
      public_id: "loadbalbin_vehicles/vehicle"
    };
  });
  t.mock.method(cloudinary.uploader, "destroy", async (publicId) => {
    removedAssets.push(publicId);
  });
  useCloudinaryTestConfig(t);

  await assert.rejects(uploadVehiclePhotos([photoFile(), photoFile()]), {
    statusCode: 502
  });
  assert.deepEqual(removedAssets, ["loadbalbin_vehicles/vehicle"]);
});

test("agency vehicle creation persists four uploaded photos and still permits no-photo registration", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const savedVehicles = [];
  let uploadCount = 0;
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "create", async (data) => {
    savedVehicles.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  });
  t.mock.method(cloudinary.uploader, "upload", async () => {
    uploadCount += 1;
    return {
      secure_url: `https://res.cloudinary.com/test/image/upload/agency-${uploadCount}.png`,
      public_id: `loadbalbin_vehicles/agency-${uploadCount}`
    };
  });
  useCloudinaryTestConfig(t);

  const create = async (vehicleNumber, files = []) => {
    const res = response();
    await createAgencyVehicle({
      user: { _id: ownerId, role: "agency" },
      body: {
        vehicleNumber,
        vehicleModel: "Test Vehicle",
        vehicleType: "mini-truck",
        loadCapacity: { value: 1000, unit: "kg" },
        bodyType: "open"
      },
      files
    }, res);
    return res;
  };

  const noPhotos = await create("PB01AA0001");
  assert.equal(noPhotos.statusCode, 201);
  assert.deepEqual(savedVehicles[0].vehicleImages, []);
  assert.equal(savedVehicles[0].vehicleImage, "");

  const fourPhotos = await create("PB01AA0002", Array.from({ length: 4 }, () => photoFile()));
  assert.equal(fourPhotos.statusCode, 201);
  assert.equal(savedVehicles[1].vehicleImages.length, 4);
  assert.equal(savedVehicles[1].vehicleImage, savedVehicles[1].vehicleImages[0]);
});

test("agency vehicle edits retain, add, replace, and remove photos within the four-photo limit", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const existing = [
    "https://res.cloudinary.com/test/image/upload/old-1.png",
    "https://res.cloudinary.com/test/image/upload/old-2.png",
    "https://res.cloudinary.com/test/image/upload/old-3.png"
  ];
  const vehicle = {
    _id: vehicleId,
    agency: agencyId,
    vehicleModel: "Test Vehicle",
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    bodyType: "open",
    vehicleImage: existing[0],
    vehicleImages: [...existing],
    save: async function () {
      return this;
    }
  };
  t.mock.method(Agency, "findOne", async () => ({ _id: agencyId }));
  t.mock.method(Vehicle, "findOne", async () => vehicle);
  t.mock.method(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://res.cloudinary.com/test/image/upload/new.png",
    public_id: "loadbalbin_vehicles/new"
  }));
  useCloudinaryTestConfig(t);

  const update = async (retainedPhotos, files = []) => {
    const res = response();
    await updateAgencyVehicle({
      user: { _id: ownerId, role: "agency" },
      params: { id: vehicleId.toString() },
      body: { existingPhotos: JSON.stringify(retainedPhotos) },
      files
    }, res);
    return res;
  };

  const edited = await update(existing.slice(0, 2), [photoFile()]);
  assert.equal(edited.statusCode, 200);
  assert.deepEqual(vehicle.vehicleImages, [...existing.slice(0, 2), "https://res.cloudinary.com/test/image/upload/new.png"]);
  assert.equal(vehicle.vehicleImage, existing[0]);

  const removed = await update([]);
  assert.equal(removed.statusCode, 200);
  assert.deepEqual(vehicle.vehicleImages, []);
  assert.equal(vehicle.vehicleImage, "");
});

test("driver vehicle API rejects more than four photos and normalizes its primary image", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  let createdVehicle;
  t.mock.method(Driver, "findOne", async () => ({ _id: new mongoose.Types.ObjectId() }));
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicle = data;
    return data;
  });

  const baseBody = {
    vehicleNumber: "PB01AA9999",
    vehicleModel: "Driver Vehicle",
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    bodyType: "open"
  };
  const tooManyResponse = response();
  await createDriverVehicle({
    user: { _id: userId },
    body: {
      ...baseBody,
      vehicleImages: Array.from({ length: 5 }, (_, index) => `https://example.com/${index}.png`)
    }
  }, tooManyResponse);
  assert.equal(tooManyResponse.statusCode, 400);
  assert.equal(createdVehicle, undefined);

  const validResponse = response();
  const photoUrls = [
    "https://example.com/1.png",
    "https://example.com/2.png",
    "https://example.com/3.png",
    "https://example.com/4.png"
  ];
  await createDriverVehicle({
    user: { _id: userId },
    body: { ...baseBody, vehicleImages: photoUrls }
  }, validResponse);
  assert.equal(validResponse.statusCode, 201);
  assert.equal(createdVehicle.vehicleImages.length, 4);
  assert.equal(createdVehicle.vehicleImage, photoUrls[0]);
});

test("vehicle photo asset cleanup tolerates an empty asset list", async () => {
  await assert.doesNotReject(removeUploadedVehiclePhotoAssets([]));
});
