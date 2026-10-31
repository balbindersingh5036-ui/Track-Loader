import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MIME_TYPES = new Map([
  ["image/jpeg", { format: "jpg", signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ["image/jpg", { format: "jpg", signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ["image/png", { format: "png", signature: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { format: "webp", signature: (buffer) => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" }]
]);

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const validateVehiclePhotoFiles = (files = []) => {
  if (!Array.isArray(files)) throw validationError("Vehicle photos must be uploaded as an image list.");
  if (files.length > MAX_PHOTOS) throw validationError("A maximum of 4 vehicle photos is allowed.");

  for (const file of files) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      throw validationError("Each vehicle photo must contain a valid image file.");
    }
    if (file.size > MAX_PHOTO_SIZE || file.buffer.length > MAX_PHOTO_SIZE) {
      throw validationError("Each vehicle photo must be 5 MB or smaller.");
    }
    const type = MIME_TYPES.get(String(file.mimetype || "").toLowerCase());
    if (!type || !type.signature(file.buffer)) {
      throw validationError("Invalid vehicle photo. Upload a JPG, JPEG, PNG, or WEBP image.");
    }
  }
};

export const removeUploadedVehiclePhotoAssets = async (assets) => {
  for (const asset of assets) {
    try {
      await cloudinary.uploader.destroy(asset.public_id, {
        type: "upload",
        resource_type: "image"
      });
    } catch (error) {
      console.error("Vehicle photo cleanup failed:", error.code || error.name || "unknown error");
    }
  }
};

export const uploadVehiclePhotos = async (files = []) => {
  validateVehiclePhotoFiles(files);
  if (!files.length) return [];
  if (!env.cloudinary.apiKey || !env.cloudinary.apiSecret || !env.cloudinary.cloudName) {
    const error = new Error("Vehicle photo upload service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const uploaded = [];
  try {
    for (const file of files) {
      const mimeType = String(file.mimetype).toLowerCase() === "image/jpg"
        ? "image/jpeg"
        : String(file.mimetype).toLowerCase();
      const dataUri = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
      const asset = await cloudinary.uploader.upload(dataUri, {
        folder: "loadbalbin_vehicles",
        resource_type: "image",
        type: "upload",
        use_filename: false,
        unique_filename: true,
        overwrite: false
      });
      if (!asset?.public_id || !asset?.secure_url?.startsWith("https://")) {
        throw new Error("Vehicle photo storage did not return a valid image reference.");
      }
      uploaded.push(asset);
    }
    return uploaded;
  } catch (error) {
    await removeUploadedVehiclePhotoAssets(uploaded);
    if (error.statusCode) throw error;
    const uploadError = new Error("One or more vehicle photos failed to upload. Please retry.");
    uploadError.statusCode = 502;
    throw uploadError;
  }
};
