import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { errorResponse, successResponse } from "../utils/response.js";

const driverDocumentTypes = new Set(["idProof", "drivingLicense"]);
const vehicleDocumentFields = {
  registration: "registration",
  insurance: "insurance"
};

const detectFileType = (buffer) => {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return { mimeType: "image/png", format: "png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", format: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return { mimeType: "image/webp", format: "webp" };
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return { mimeType: "application/pdf", format: "pdf" };
  }
  return null;
};

const uploadPrivateDocument = async (file) => {
  if (!env.cloudinary.apiKey || !env.cloudinary.apiSecret || !env.cloudinary.cloudName) {
    const error = new Error("Document upload service is not configured");
    error.statusCode = 503;
    throw error;
  }

  const detected = detectFileType(file.buffer);
  const uploadedMimeType = file.mimetype.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : file.mimetype.toLowerCase();
  if (!detected || detected.mimeType !== uploadedMimeType) {
    const error = new Error("The selected file is not a supported image or PDF");
    error.statusCode = 400;
    throw error;
  }

  const dataUri = `data:${detected.mimeType};base64,${file.buffer.toString("base64")}`;
  const asset = await cloudinary.uploader.upload(dataUri, {
    folder: "loadbalbin_kyc",
    resource_type: "auto",
    type: "authenticated",
    use_filename: false,
    unique_filename: true,
    overwrite: false
  });

  if (!asset.public_id || !asset.secure_url) {
    const error = new Error("Private document storage did not return an asset reference");
    error.statusCode = 502;
    throw error;
  }

  return {
    asset,
    detected
  };
};

const removeUploadedAsset = async (asset) => {
  if (!asset?.public_id) return;
  try {
    await cloudinary.uploader.destroy(asset.public_id, {
      type: "authenticated",
      resource_type: asset.resource_type || "image"
    });
  } catch (error) {
    console.error("Private document cleanup failed:", error.code || error.name || "unknown error");
  }
};

const canManageDriver = async (req, driver) => {
  if (req.user.role === "driver") {
    return String(driver.user) === String(req.user._id);
  }
  if (req.user.role !== "agency" || !driver.agency) return false;
  const agency = await Agency.findOne({ owner: req.user._id }).select("_id").lean();
  return Boolean(agency && String(driver.agency) === String(agency._id));
};

export const uploadDriverDocument = async (req, res) => {
  let uploadedAsset;
  try {
    const { driverId, docType } = req.params;
    if (!mongoose.isValidObjectId(driverId)) return errorResponse(res, "Invalid driver ID", 400);
    if (!driverDocumentTypes.has(docType)) return errorResponse(res, "Invalid driver document type", 400);
    if (!req.file) return errorResponse(res, "A document file is required", 400);

    const driver = await Driver.findById(driverId);
    if (!driver) return errorResponse(res, "Driver not found", 404);
    if (!await canManageDriver(req, driver)) {
      return errorResponse(res, "You are not authorized to submit documents for this driver", 403);
    }

    const { asset, detected } = await uploadPrivateDocument(req.file);
    uploadedAsset = asset;
    driver.documents[docType] = {
      url: asset.secure_url,
      publicId: asset.public_id,
      resourceType: asset.resource_type || "image",
      format: asset.format || detected.format,
      status: "pending",
      submittedAt: new Date(),
      uploadedBy: req.user._id,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: ""
    };
    driver.markModified("documents");
    await driver.save();

    return successResponse(res, {
      document: {
        status: driver.documents[docType].status,
        submittedAt: driver.documents[docType].submittedAt,
        format: driver.documents[docType].format
      }
    }, "Document submitted for administrator review", 201);
  } catch (error) {
    if (uploadedAsset) await removeUploadedAsset(uploadedAsset);
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error("Driver document submission failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to submit document. Please try again.", 500);
  }
};

export const uploadVehicleDocument = async (req, res) => {
  let uploadedAsset;
  try {
    const { vehicleId, docType } = req.params;
    if (!mongoose.isValidObjectId(vehicleId)) return errorResponse(res, "Invalid vehicle ID", 400);
    const field = vehicleDocumentFields[docType];
    if (!field) return errorResponse(res, "Invalid vehicle document type", 400);
    if (!req.file) return errorResponse(res, "A document file is required", 400);

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return errorResponse(res, "Vehicle not found", 404);

    let authorized = false;
    if (req.user.role === "driver") {
      const driver = await Driver.findOne({ user: req.user._id }).select("_id agency").lean();
      authorized = Boolean(
        driver &&
        !driver.agency &&
        !vehicle.agency &&
        String(vehicle.driver) === String(driver._id)
      );
    } else if (req.user.role === "agency" && vehicle.agency) {
      const agency = await Agency.findOne({ owner: req.user._id }).select("_id").lean();
      authorized = Boolean(agency && String(vehicle.agency) === String(agency._id));
    }
    if (!authorized) {
      return errorResponse(res, "Only the vehicle owner or its managing agency may submit vehicle documents", 403);
    }

    const { asset, detected } = await uploadPrivateDocument(req.file);
    uploadedAsset = asset;
    vehicle.documents[field] = {
      url: asset.secure_url,
      publicId: asset.public_id,
      resourceType: asset.resource_type || "image",
      format: asset.format || detected.format,
      status: "pending",
      submittedAt: new Date(),
      uploadedBy: req.user._id,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: ""
    };
    vehicle.markModified("documents");
    await vehicle.save();

    return successResponse(res, {
      document: {
        status: vehicle.documents[field].status,
        submittedAt: vehicle.documents[field].submittedAt,
        format: vehicle.documents[field].format
      }
    }, "Vehicle document submitted for administrator review", 201);
  } catch (error) {
    if (uploadedAsset) await removeUploadedAsset(uploadedAsset);
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error("Vehicle document submission failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to submit vehicle document. Please try again.", 500);
  }
};
