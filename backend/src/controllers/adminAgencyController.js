import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { sanitizeDriverDocumentResponse } from "../utils/driverDocumentResponse.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";
import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "../utils/documentSigner.js";
import {
  isDesignatedSuperAdmin,
  isSuperAdminConfigured
} from "../utils/superAdmin.js";

export const getAdminAgencies = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const query = {};

    if (req.query.approvalStatus) {
      if (!["pending", "approved", "rejected", "suspended"].includes(req.query.approvalStatus)) {
        return errorResponse(res, "Invalid approvalStatus", 400);
      }
      query.approvalStatus = req.query.approvalStatus;
    }

    if (req.query.search) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(search, "i");
      query.$or = [{ agencyName: regex }, { phone: regex }, { email: regex }];
    }

    const [agencies, total] = await Promise.all([
      Agency.find(query)
        .select("-documents")
        .populate("owner", "name phone email profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Agency.countDocuments(query)
    ]);

    return successResponse(
      res,
      {
        agencies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      "Agencies fetched successfully"
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch agencies", 500);
  }
};

export const getAdminAgencyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const canReviewAgencyDocuments = isDesignatedSuperAdmin(req.user);
    const superAdminReviewConfigured = isSuperAdminConfigured();
    const agency = await Agency.findById(id)
      .populate("owner", "name phone email profileImage")
      .populate("approvedBy", "name role")
      .populate("documents.ownerAadhaar.reviewedBy", "name role")
      .populate("documents.businessRegistration.reviewedBy", "name role")
      .populate("documents.taxId.reviewedBy", "name role")
      .populate("reviewHistory.reviewedBy", "name role");
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const [drivers, vehicles] = await Promise.all([
      Driver.find({ agency: agency._id })
        .populate("user", "name phone email")
        .populate("documents.idProof.uploadedBy", "name")
        .populate("documents.drivingLicense.uploadedBy", "name"),
      Vehicle.find({ agency: agency._id })
        .populate("driver", "fullName phone")
        .populate("documents.registration.uploadedBy", "name")
        .populate("documents.registration.reviewedBy", "name")
        .populate("documents.insurance.uploadedBy", "name")
        .populate("documents.insurance.reviewedBy", "name")
    ]);

    const agencyObj = agency.toObject();

    if (agencyObj.documents) {
      for (const [key, doc] of Object.entries(agencyObj.documents)) {
        if (!doc) continue;
        const hasDocument = Boolean(doc.publicId || doc.url);
        let publicId = doc.publicId;
        let format = doc.format || "pdf";
        if (!publicId && doc.url) {
          const asset = extractCloudinaryAssetInfo(doc.url);
          if (asset) {
            publicId = asset.publicId;
            format = asset.format;
          }
        }
        doc.viewUrl = canReviewAgencyDocuments && publicId?.startsWith("loadbalbin_kyc/")
          ? generateSignedDocumentUrl(publicId, format, 300, doc.resourceType || "image")
          : null;
        doc.status = hasDocument ? doc.status || "pending" : "not_uploaded";
        doc.uploadedBy = doc.uploadedBy?.name || null;
        doc.reviewedBy = doc.reviewedBy?.name || null;
        delete doc.url;
        delete doc.publicId;
      }
    }
    agencyObj.canReviewAgencyDocuments = canReviewAgencyDocuments;
    agencyObj.superAdminReviewConfigured = superAdminReviewConfigured;

    const enhancedDrivers = drivers.map((d) => {
      const dObj = d.toObject();
      dObj.canReviewDocuments = isDesignatedSuperAdmin(req.user);
      return sanitizeDriverDocumentResponse(dObj, { includeSignedUrls: canReviewAgencyDocuments });
    });

    return successResponse(res, {
      agency: agencyObj,
      drivers: enhancedDrivers,
      vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle.toObject(), { includeSignedUrls: canReviewAgencyDocuments })),
      canReviewAgencyDocuments,
      superAdminReviewConfigured
    }, "Agency details fetched");
  } catch (error) {
    console.error("getAdminAgencyById failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to fetch agency details", 500);
  }
};

export const approveAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "approved",
          approvedAt: new Date(),
          approvedBy: req.user._id,
          rejectionReason: ""
        },
        $push: {
          reviewHistory: {
            action: "approved",
            reviewedBy: req.user._id,
            reviewedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency approved successfully");
  } catch (error) {
    return errorResponse(res, "Failed to approve agency", 500);
  }
};

export const rejectAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }
    if (Object.keys(req.body || {}).some((key) => key !== "reason") || typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) {
      return errorResponse(res, "A rejection reason of 1 to 500 characters is required", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "rejected",
          rejectionReason: reason.trim()
        },
        $push: {
          reviewHistory: {
            action: "rejected",
            reason: reason.trim(),
            reviewedBy: req.user._id,
            reviewedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency rejected successfully");
  } catch (error) {
    return errorResponse(res, "Failed to reject agency", 500);
  }
};

export const suspendAdminAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid agency ID", 400);
    }
    if (Object.keys(req.body || {}).some((key) => key !== "reason") || typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) {
      return errorResponse(res, "A suspension reason of 1 to 500 characters is required", 400);
    }

    const agency = await Agency.findByIdAndUpdate(
      id,
      {
        $set: {
          approvalStatus: "suspended",
          rejectionReason: reason.trim()
        },
        $push: {
          reviewHistory: {
            action: "suspended",
            reason: reason.trim(),
            reviewedBy: req.user._id,
            reviewedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency }, "Agency suspended successfully");
  } catch (error) {
    return errorResponse(res, "Failed to suspend agency", 500);
  }
};

export const reviewAdminAgencyDocument = async (req, res) => {
  try {
    const { id, docType, action } = req.params;
    if (!mongoose.isValidObjectId(id)) return errorResponse(res, "Invalid agency ID", 400);
    if (!["ownerAadhaar", "businessRegistration", "taxId"].includes(docType)) {
      return errorResponse(res, "Invalid agency document type", 400);
    }
    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, "Invalid document review action", 400);
    }

    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.some((key) => key !== "reason" || action === "approve")) {
      return errorResponse(res, "Invalid document review request", 400);
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (action === "reject" && (!reason || reason.length > 500)) {
      return errorResponse(res, "A rejection reason of 1 to 500 characters is required", 400);
    }

    const agency = await Agency.findById(id);
    if (!agency) return errorResponse(res, "Agency not found", 404);
    const document = agency.documents?.[docType];
    if (!document || (!document.publicId && !document.url)) {
      return errorResponse(res, "This document has not been submitted", 404);
    }
    const assetInfo = document.publicId
      ? { publicId: document.publicId }
      : extractCloudinaryAssetInfo(document.url);
    if (!assetInfo?.publicId?.startsWith("loadbalbin_kyc/")) {
      return errorResponse(res, "This document must be resubmitted to the private KYC vault before review", 409);
    }

    document.status = action === "approve" ? "approved" : "rejected";
    document.reviewedAt = new Date();
    document.reviewedBy = req.user._id;
    document.rejectionReason = action === "reject" ? reason : "";
    agency.reviewHistory.push({
      action: action === "approve" ? "document_approved" : "document_rejected",
      documentType: docType,
      reason: action === "reject" ? reason : "",
      reviewedBy: req.user._id,
      reviewedAt: document.reviewedAt
    });
    agency.markModified("documents");
    await agency.save();

    return successResponse(res, {
      document: {
        status: document.status,
        submittedAt: document.submittedAt,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason
      }
    }, `Agency document ${document.status}`);
  } catch (error) {
    console.error("Agency document review failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to review agency document", 500);
  }
};
