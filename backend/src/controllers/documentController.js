import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { errorResponse, successResponse } from "../utils/response.js";

const driverDocumentTypes = new Set(["idProof", "drivingLicense"]);
const agencyDocumentTypes = new Set(["ownerAadhaar", "businessRegistration", "taxId", "tradeLicense", "gstCertificate"]);
const vehicleDocumentFields = {
  registration: "registration",
  insurance: "insurance"
};

const MAX_PRIVATE_DOCUMENT_SIZE = 5 * 1024 * 1024;

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

export const validatePrivateDocument = (file) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error("A document file is required");
    error.statusCode = 400;
    throw error;
  }
  if (file.size > MAX_PRIVATE_DOCUMENT_SIZE || file.buffer.length > MAX_PRIVATE_DOCUMENT_SIZE) {
    const error = new Error("File size exceeds the maximum limit of 5MB");
    error.statusCode = 400;
    throw error;
  }

  const detected = detectFileType(file.buffer);
  const fileMimeType = String(file.mimetype || "").toLowerCase();
  const uploadedMimeType = fileMimeType === "image/jpg"
    ? "image/jpeg"
    : fileMimeType;
  if (!detected || detected.mimeType !== uploadedMimeType) {
    const error = new Error("The selected file is not a supported image or PDF");
    error.statusCode = 400;
    throw error;
  }
  return detected;
};

export const uploadPrivateDocument = async (file) => {
  if (!env.cloudinary.apiKey || !env.cloudinary.apiSecret || !env.cloudinary.cloudName) {
    const error = new Error("Document upload service is not configured");
    error.statusCode = 503;
    throw error;
  }

  const detected = validatePrivateDocument(file);

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

export const removeUploadedAsset = async (asset) => {
  if (!asset?.public_id) return true;
  try {
    await cloudinary.uploader.destroy(asset.public_id, {
      type: "authenticated",
      resource_type: asset.resource_type || "image"
    });
    return true;
  } catch (error) {
    console.error("Private document cleanup failed:", error.code || error.name || "unknown error");
    return false;
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

export const uploadAgencyDocument = async (req, res) => {
  let uploadedAsset;
  try {
    const { agencyId, docType } = req.params;
    if (!mongoose.isValidObjectId(agencyId)) return errorResponse(res, "Invalid agency ID", 400);
    if (!agencyDocumentTypes.has(docType)) return errorResponse(res, "Invalid agency document type", 400);
    if (!req.file) return errorResponse(res, "A document file is required", 400);
    if (req.user.role !== "agency") {
      return errorResponse(res, "Only the agency owner may submit agency documents", 403);
    }

    const agency = await Agency.findOne({ _id: agencyId, owner: req.user._id });
    if (!agency) return errorResponse(res, "Agency not found for this owner", 404);
    const existingDocument = agency.documents?.[docType];
    const existingAssetInfo = existingDocument?.publicId
      ? { publicId: existingDocument.publicId }
      : null;
    if (
      existingDocument?.status === "pending" &&
      existingAssetInfo?.publicId?.startsWith("loadbalbin_kyc/")
    ) {
      return errorResponse(res, "This document is already pending Super Admin review", 409);
    }

    const { asset, detected } = await uploadPrivateDocument(req.file);
    uploadedAsset = asset;
    agency.documents[docType] = {
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
    agency.markModified("documents");
    await agency.save();

    return successResponse(res, {
      document: {
        status: agency.documents[docType].status,
        submittedAt: agency.documents[docType].submittedAt,
        format: agency.documents[docType].format
      }
    }, "Agency document submitted for Super Admin review", 201);
  } catch (error) {
    if (uploadedAsset) await removeUploadedAsset(uploadedAsset);
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error("Agency document submission failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to submit agency document. Please try again.", 500);
  }
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
    const reviewHistory = vehicle.documents[field]?.reviewHistory || [];
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
      rejectionReason: "",
      reviewHistory
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
