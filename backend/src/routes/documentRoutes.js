import express from "express";
import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import { protect } from "../middleware/authMiddleware.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { generateSignedDocumentUrl, extractCloudinaryAssetInfo } from "../utils/documentSigner.js";

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

  // Generate 5-minute signed delivery URL
  const viewUrl = publicId
    ? generateSignedDocumentUrl(publicId, format, 300, resourceType)
    : doc.url;

  return {
    status: doc.status || "pending",
    viewUrl,
    format,
    resourceType,
    maskedNumber: doc.maskedNumber || "",
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

    const validTypes = ["ownerAadhaar", "businessRegistration", "taxId"];
    if (!validTypes.includes(docType)) {
      return errorResponse(res, "Invalid agency document type requested", 400);
    }

    const agency = await Agency.findById(agencyId);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    // Authorization check: Super Admin or owner of the agency
    const isSuperAdmin = req.user.role === "admin";
    const isOwner = String(agency.owner) === String(req.user._id);

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
    console.error("Document view error:", error);
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

    const isSuperAdmin = req.user.role === "admin";
    const isSelfDriver = String(driver.user) === String(req.user._id);

    let isManagingAgencyOwner = false;
    if (driver.agency) {
      const agency = await Agency.findById(driver.agency);
      if (agency && String(agency.owner) === String(req.user._id)) {
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
    console.error("Driver document view error:", error);
    return errorResponse(res, "Failed to retrieve document", 500);
  }
});

export default router;
