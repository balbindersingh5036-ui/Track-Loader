import express from "express";
import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import { protect } from "../middleware/authMiddleware.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { generateSignedDocumentUrl, extractCloudinaryAssetInfo } from "../utils/documentSigner.js";
import { handleUploadSingle } from "../middleware/uploadMiddleware.js";
import {
  uploadAgencyDocument,
  uploadDriverDocument,
  uploadVehicleDocument
} from "../controllers/documentController.js";
import { isDesignatedSuperAdmin } from "../utils/superAdmin.js";

const router = express.Router();

// Helper to determine and generate a temporary signed viewing URL
const createDocumentViewPayload = (doc) => {
  if (!doc) return null;

  let publicId = doc.publicId;
  let format = doc.format || "pdf";
  let resourceType = doc.resourceType || "image";

  // If publicId was not saved directly, try extracting from the url
  if (!publicId && doc.url) {
    const extracted = extractCloudinaryAssetInfo(doc.url);
    if (extracted) {
      publicId = extracted.publicId;
      format = extracted.format;
    }
  }

  const isPrivateKycAsset = typeof publicId === "string" && (
    publicId.includes("loadbalbin_kyc/") || publicId.includes("loadbalbin_profiles/")
  );
  const viewUrl = isPrivateKycAsset
    ? generateSignedDocumentUrl(publicId, format, 300, resourceType)
    : (!isPrivateKycAsset && doc.url && typeof doc.url === "string" && doc.url.startsWith("http") && !doc.url.includes("cloudinary.com") ? doc.url : null);

  return {
    status: doc.status || (doc.url || doc.publicId ? "pending" : "not_uploaded"),
    viewUrl,
    format,
    maskedNumber: doc.maskedNumber || "",
    submittedAt: doc.submittedAt || null,
    rejectionReason: doc.rejectionReason || "",
    uploadedBy: doc.uploadedBy?.name || null,
    expiresInSeconds: 300
  };
};

/**
 * GET /api/documents/agency/:agencyId/:docType
 * Authorized: Super Admin, or the Agency Owner of the specified agency
 */
router.get("/agency/:agencyId/:docType", protect, async (req, res) => {
  try {
    const { agencyId, docType } = req.params;
    if (!mongoose.Types.ObjectId.isValid(agencyId)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const validTypes = ["ownerAadhaar", "businessRegistration", "taxId", "tradeLicense", "gstCertificate"];
    if (!validTypes.includes(docType)) {
      return errorResponse(res, "Invalid agency document type requested", 400);
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    // Authorization check: Super Admin or owner of the agency
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const isSuperAdmin = isDesignatedSuperAdmin(req.user);
    const isOwner = Boolean(userId && agency.owner && String(agency.owner) === userId);

    if (!isSuperAdmin && !isOwner) {
      return errorResponse(res, "Access denied. You are not authorized to view this agency's KYC documents.", 403);
    }

    const doc = agency.documents?.[docType];
    if (!doc || (!doc.url && !doc.publicId)) {
      return errorResponse(res, "Requested document has not been uploaded yet", 404);
    }

    const payload = createDocumentViewPayload(doc);
    return successResponse(res, { document: payload }, "Temporary authorized document link generated");
  } catch (error) {
    console.error("Document view failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to retrieve document", 500);
  }
});

/**
 * GET /api/documents/driver/:driverId/:docType
 * Authorized: Super Admin, the Driver themselves, or the Agency Owner managing the driver
 */
router.get("/driver/:driverId/:docType", protect, async (req, res) => {
  try {
    const { driverId, docType } = req.params;
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return errorResponse(res, "Invalid driver ID", 400);
    }

    const validTypes = ["idProof", "drivingLicense", "vehicleRegistration", "insurance"];
    if (!validTypes.includes(docType)) {
      return errorResponse(res, "Invalid driver document type requested", 400);
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return errorResponse(res, "Driver not found", 404);
    }

    const userId = String(req.user?._id || req.user?.id || "").trim();
    const driverUserId = String(driver.user?._id || driver.user || "").trim();
    const isSuperAdmin = isDesignatedSuperAdmin(req.user);
    const isSelfDriver = Boolean(userId && driverUserId && driverUserId === userId);

    let isManagingAgencyOwner = false;
    if (driver.agency) {
      const agency = await Agency.findById(driver.agency);
      if (agency && agency.owner && String(agency.owner) === userId) {
        isManagingAgencyOwner = true;
      }
    }

    if (!isSuperAdmin && !isSelfDriver && !isManagingAgencyOwner) {
      return errorResponse(res, "Access denied. You are not authorized to view this driver's KYC documents.", 403);
    }

    const doc = driver.documents?.[docType];
    if (!doc || (!doc.url && !doc.publicId)) {
      return errorResponse(res, "Requested document has not been uploaded yet", 404);
    }

    const payload = createDocumentViewPayload(doc);
    return successResponse(res, { document: payload }, "Temporary authorized document link generated");
  } catch (error) {
    console.error("Driver document view failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to retrieve document", 500);
  }
});

router.post("/agency/:agencyId/:docType", protect, handleUploadSingle("document"), uploadAgencyDocument);
router.post("/driver/:driverId/:docType", protect, handleUploadSingle("document"), uploadDriverDocument);
router.post("/vehicle/:vehicleId/:docType", protect, handleUploadSingle("document"), uploadVehicleDocument);

router.get("/vehicle/:vehicleId/:docType", protect, async (req, res) => {
  try {
    const { vehicleId, docType } = req.params;
    if (!mongoose.Types.ObjectId.isValid(vehicleId)) return errorResponse(res, "Invalid vehicle ID", 400);
    if (!["registration", "insurance"].includes(docType)) {
      return errorResponse(res, "Invalid vehicle document type requested", 400);
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return errorResponse(res, "Vehicle not found", 404);

    const userId = String(req.user?._id || req.user?.id || "").trim();
    let authorized = isDesignatedSuperAdmin(req.user);
    if (req.user.role === "driver") {
      const driver = await Driver.findOne({ user: userId }).select("_id").lean();
      authorized = Boolean(driver && String(vehicle.driver) === String(driver._id));
    } else if (req.user.role === "agency" && vehicle.agency) {
      const agency = await Agency.findOne({ owner: userId }).select("_id").lean();
      authorized = Boolean(agency && String(vehicle.agency) === String(agency._id));
    }
    if (!authorized) return errorResponse(res, "Access denied. You are not authorized to view this vehicle document.", 403);

    const doc = vehicle.documents?.[docType];
    if (!doc || (!doc.url && !doc.publicId)) return errorResponse(res, "Requested document has not been uploaded yet", 404);
    return successResponse(res, { document: createDocumentViewPayload(doc) }, "Temporary authorized document link generated");
  } catch (error) {
    console.error("Vehicle document view failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to retrieve document", 500);
  }
});

export default router;
