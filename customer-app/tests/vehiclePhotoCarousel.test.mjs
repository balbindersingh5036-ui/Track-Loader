import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVehiclePhotoUrls,
  createInfinitePhotoBuffer,
  getNextPhotoIndex,
  getPrevPhotoIndex
} from "../src/utils/vehiclePhotos.js";

test("extractVehiclePhotoUrls with 1 photo in vehicleImage", () => {
  const vehicle = {
    vehicleModel: "Electric Cargo Loader",
    vehicleImage: "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/loader_1.jpg"
  };
  const photos = extractVehiclePhotoUrls(vehicle);
  assert.equal(photos.length, 1);
  assert.equal(photos[0], "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/loader_1.jpg");
});

test("extractVehiclePhotoUrls with 2, 3, and 4 photos in vehicleImages", () => {
  const v2 = {
    vehicleImages: [
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg"
    ]
  };
  const p2 = extractVehiclePhotoUrls(v2);
  assert.equal(p2.length, 2);

  const v3 = {
    vehicleImages: [
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p3.jpg"
    ]
  };
  const p3 = extractVehiclePhotoUrls(v3);
  assert.equal(p3.length, 3);

  const v4 = {
    vehicleImages: [
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p3.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p4.jpg"
    ]
  };
  const p4 = extractVehiclePhotoUrls(v4);
  assert.equal(p4.length, 4);
});

test("extractVehiclePhotoUrls deduplicates vehicleImage and vehicleImages", () => {
  const vehicle = {
    vehicleImage: "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
    vehicleImages: [
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p3.jpg"
    ]
  };
  const photos = extractVehiclePhotoUrls(vehicle);
  assert.equal(photos.length, 3);
  assert.equal(photos[0], "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg");
  assert.equal(photos[1], "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg");
  assert.equal(photos[2], "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p3.jpg");
});

test("extractVehiclePhotoUrls caps at maximum 4 photos", () => {
  const vehicle = {
    vehicleImages: [
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p1.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p2.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p3.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p4.jpg",
      "https://res.cloudinary.com/loadbalbin/image/upload/v1/vehicles/p5.jpg"
    ]
  };
  const photos = extractVehiclePhotoUrls(vehicle);
  assert.equal(photos.length, 4);
});

test("extractVehiclePhotoUrls handles empty, null, and invalid URL edge cases safely", () => {
  assert.deepEqual(extractVehiclePhotoUrls(null), []);
  assert.deepEqual(extractVehiclePhotoUrls(undefined), []);
  assert.deepEqual(extractVehiclePhotoUrls({}), []);
  assert.deepEqual(extractVehiclePhotoUrls({ vehicleImages: [] }), []);
  assert.deepEqual(extractVehiclePhotoUrls({ vehicleImages: ["", "  ", null, 123] }), []);
  assert.deepEqual(
    extractVehiclePhotoUrls({ vehicleImages: ["ftp://invalid-url.com", "not-a-url"] }),
    []
  );
});

test("Infinite loop buffer construction for 1, 2, 3, and 4 photos", () => {
  // 1 photo: no buffer modification
  const p1 = ["img1"];
  assert.deepEqual(createInfinitePhotoBuffer(p1), ["img1"]);

  // 2 photos: buffer [last, p0, p1, first]
  const p2 = ["img1", "img2"];
  assert.deepEqual(createInfinitePhotoBuffer(p2), ["img2", "img1", "img2", "img1"]);
  assert.equal(createInfinitePhotoBuffer(p2).length, 4);

  // 3 photos: buffer [last, p0, p1, p2, first]
  const p3 = ["img1", "img2", "img3"];
  assert.deepEqual(createInfinitePhotoBuffer(p3), ["img3", "img1", "img2", "img3", "img1"]);
  assert.equal(createInfinitePhotoBuffer(p3).length, 5);

  // 4 photos: buffer [last, p0, p1, p2, p3, first]
  const p4 = ["img1", "img2", "img3", "img4"];
  assert.deepEqual(createInfinitePhotoBuffer(p4), ["img4", "img1", "img2", "img3", "img4", "img1"]);
  assert.equal(createInfinitePhotoBuffer(p4).length, 6);
});

test("Infinite loop seamless navigation math", () => {
  const N = 4; // 4 photos: indices 0, 1, 2, 3

  assert.equal(getNextPhotoIndex(0, N), 1);
  assert.equal(getNextPhotoIndex(1, N), 2);
  assert.equal(getNextPhotoIndex(2, N), 3);
  assert.equal(getNextPhotoIndex(3, N), 0); // seamlessly wraps to 0

  assert.equal(getPrevPhotoIndex(3, N), 2);
  assert.equal(getPrevPhotoIndex(2, N), 1);
  assert.equal(getPrevPhotoIndex(1, N), 0);
  assert.equal(getPrevPhotoIndex(0, N), 3); // seamlessly wraps to 3
});
