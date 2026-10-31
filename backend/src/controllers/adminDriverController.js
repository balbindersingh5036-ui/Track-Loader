import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Agency from "../models/Agency.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { hasApprovedDriverIdentityDocuments } from "../utils/driverEligibility.js";
import { extractCloudinaryAssetInfo } from "../utils/documentSigner.js";
import { isDesignatedSuperAdmin } from "../utils/superAdmin.js";
import { getActualDriverUserFilter } from "../utils/actualDriver.js";

const safeDriver = (driver, vehicles = [], canApproveDriver = false) => {
  const isAgencyLinked = Boolean(driver.agency);
  const agencyAccepted = !isAgencyLinked || driver.agencyAssociation?.status === "approved";
  const hasApprovedDocs = hasApprovedDriverIdentityDocuments(driver);
  const eligibleForSuperAdminApproval = canApproveDriver && hasApprovedDocs && agencyAccepted && driver.approvalStatus !== "approved";

  const docs = driver.documents || {};
  const docConfig = [
    { key: "idProof", label: "Aadhaar / Identity Proof", mandatory: true },
    { key: "drivingLicense", label: "Driving Licence", mandatory: true }
  ];

  const sanitizedDocs = {};
  const kycSummary = [];

  for (const { key, label, mandatory } of docConfig) {
    const doc = docs[key];
    const isSubmitted = Boolean(doc && (doc.publicId || doc.url || (doc.status && doc.status !== "not_uploaded" && doc.status !== "missing")));
    const status = isSubmitted ? (doc?.status || "pending") : "missing";

    const docObj = {
      key,
      label,
      mandatory,
      isSubmitted,
      status,
      submittedAt: doc?.submittedAt || null,
      reviewedAt: doc?.reviewedAt || null,
      rejectionReason: doc?.rejectionReason || ""
    };

    sanitizedDocs[key] = docObj;
    kycSummary.push(docObj);
  }

  return {
    id: driver._id,
    name: driver.user?.name || driver.fullName,
    phone: driver.user?.phone || driver.phone,
    email: driver.user?.email || driver.email || "",
    profileImage: driver.user?.profileImage || driver.profileImage || "",
    rating: driver.rating,
    totalTrips: driver.totalTrips,
    approvalStatus: driver.approvalStatus,
    rejectionReason: driver.rejectionReason || "",
    isOnline: driver.isOnline,
    isActive: driver.isActive,
    createdAt: driver.createdAt,
    agency: driver.agency
      ? {
          id: driver.agency._id || driver.agency,
          agencyName: driver.agency.agencyName || "",
          city: driver.agency.city || ""
        }
      : null,
    agencyAssociation: driver.agency
      ? {
          status: driver.agencyAssociation?.status || "pending",
          rejectionReason: driver.agencyAssociation?.rejectionReason || "",
          decidedAt: driver.agencyAssociation?.decidedAt || null,
          decisionAt: driver.agencyAssociation?.decisionAt || driver.agencyAssociation?.decidedAt || null,
          reviewedBy: driver.agencyAssociation?.reviewedBy || null
        }
      : {
          status: "none",
          rejectionReason: "",
          decidedAt: null,
          decisionAt: null,
          reviewedBy: null
        },
    canApproveDriver: eligibleForSuperAdminApproval,
    documents: sanitizedDocs,
    kycDocuments: kycSummary,
    vehicles: (vehicles || []).map((vehicle) => ({
      id: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleModel: vehicle.vehicleModel,
      vehicleType: vehicle.vehicleType,
      loadCapacity: vehicle.loadCapacity,
      isAvailable: vehicle.isAvailable,
      isActive: vehicle.isActive,
      documents: Object.fromEntries(["registration", "insurance"].map((key) => {
        const document = vehicle.documents?.[key] || {};
        return [key, {
          status: document.url || document.publicId ? document.status || "pending" : document.status || "not_uploaded",
          submittedAt: document.submittedAt || null,
          reviewedAt: document.reviewedAt || null,
          rejectionReason: document.rejectionReason || ""
        }];
      }))
    }))
  };
};

const loadVehiclesByDriver = async (drivers) => {
  const ids = drivers.map((driver) => driver._id);
  const vehicles = ids.length
    ? await Vehicle.find({ driver: { $in: ids } })
      .select("driver vehicleNumber vehicleModel vehicleType loadCapacity isAvailable isActive documents.registration documents.insurance")
      .lean()
    : [];
  return new Map(ids.map((id) => [
    id.toString(),
    vehicles.filter((vehicle) => vehicle.driver.toString() === id.toString())
  ]));
};

export const getAdminDrivers = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const query = {};
    Object.assign(query, await getActualDriverUserFilter());

    if (req.query.approvalStatus !== undefined) {
      if (!["pending", "approved", "rejected", "suspended"].includes(req.query.approvalStatus)) {
        return errorResponse(res, "Invalid approvalStatus", 400);
      }
      query.approvalStatus = req.query.approvalStatus;
    }

    if (req.query.isOnline !== undefined) {
      if (!["true", "false"].includes(req.query.isOnline)) {
        return errorResponse(res, "isOnline must be true or false", 400);
      }
      query.isOnline = req.query.isOnline === "true";
    }

    const extraConditions = [];

    if (req.query.filter !== undefined) {
      const f = req.query.filter;
      if (f === "pending_agency") {
        query.agency = { $ne: null };
        query["agencyAssociation.status"] = "pending";
        query.approvalStatus = { $nin: ["rejected", "suspended"] };
      } else if (f === "agency_accepted_pending_super_admin") {
        query.agency = { $ne: null };
        query["agencyAssociation.status"] = "approved";
        query.approvalStatus = "pending";
      } else if (f === "pending_kyc") {
        query.approvalStatus = { $nin: ["rejected", "suspended"] };
        extraConditions.push({
          $or: [
            { "documents.idProof.status": { $ne: "approved" } },
            { "documents.drivingLicense.status": { $ne: "approved" } }
          ]
        });
      } else if (f === "pending_final_approval") {
        query["documents.idProof.status"] = "approved";
        query["documents.drivingLicense.status"] = "approved";
        query.approvalStatus = "pending";
        extraConditions.push({
          $or: [
            { agency: null },
            { "agencyAssociation.status": "approved" }
          ]
        });
      } else if (f === "fully_approved") {
        query.approvalStatus = "approved";
        query.isActive = true;
        query["documents.idProof.status"] = "approved";
        query["documents.drivingLicense.status"] = "approved";
        extraConditions.push({
          $or: [
            { agency: null },
            { "agencyAssociation.status": "approved" }
          ]
        });
      } else if (f === "rejected") {
        extraConditions.push({
          $or: [
            { approvalStatus: "rejected" },
            { "agencyAssociation.status": "rejected" }
          ]
        });
      } else if (f === "suspended") {
        query.approvalStatus = "suspended";
      } else if (f !== "all" && f !== "") {
        return errorResponse(res, "Invalid filter", 400);
      }
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const term = req.query.search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

      const searchOr = [
        { fullName: regex },
        { phone: regex },
        { email: regex }
      ];

      const matchingUsers = await User.find({
        role: "driver",
        $or: [{ name: regex }, { phone: regex }, { email: regex }]
      }).select("_id").lean();
      if (matchingUsers.length > 0) {
        searchOr.push({ user: { $in: matchingUsers.map((u) => u._id) } });
      }

      const matchingAgencies = await Agency.find({
        agencyName: regex
      }).select("_id").lean();
      if (matchingAgencies.length > 0) {
        searchOr.push({ agency: { $in: matchingAgencies.map((a) => a._id) } });
      }

      if (mongoose.isValidObjectId(term)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(term) });
      }

      extraConditions.push({ $or: searchOr });
    }

    if (extraConditions.length === 1) {
      Object.assign(query, extraConditions[0]);
    } else if (extraConditions.length > 1) {
      query.$and = extraConditions;
    }

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .populate("user", "name phone email profileImage")
        .populate("agency", "agencyName city")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Driver.countDocuments(query)
    ]);
    const vehiclesByDriver = await loadVehiclesByDriver(drivers);

    return successResponse(res, {
      drivers: drivers.map((driver) => safeDriver(
        driver,
        vehiclesByDriver.get(driver._id.toString()),
        isDesignatedSuperAdmin(req.user)
      )),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    }, "Drivers fetched");
  } catch (error) {
    console.error("Admin driver list error:", error);
    return errorResponse(res, "Failed to fetch drivers", 500);
  }
};

export const getAdminDriverById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid driver ID", 400);
    const driver = await Driver.findById(req.params.id)
      .populate("user", "name phone email profileImage")
      .populate("agency", "agencyName phone email address city approvalStatus isActive")
      .populate("agencyAssociation.reviewedBy", "name role")
      .populate("documents.idProof.uploadedBy", "name role")
      .populate("documents.idProof.reviewedBy", "name role")
      .populate("documents.drivingLicense.uploadedBy", "name role")
      .populate("documents.drivingLicense.reviewedBy", "name role")
      .lean();
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    const canReviewDocuments = isDesignatedSuperAdmin(req.user);
    const driverData = safeDriver(driver, vehiclesByDriver.get(driver._id.toString()), canReviewDocuments);

    // Allow authorized admin in detail view to inspect driver KYC documents with short-lived signed URLs
    const docs = Object.fromEntries(
      ["idProof", "drivingLicense"].map((key) => [
        key,
        driver.documents?.[key] ? JSON.parse(JSON.stringify(driver.documents[key])) : { status: "not_uploaded" }
      ])
    );
    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    const supportedDocKeys = ["idProof", "drivingLicense"];
    for (const key of supportedDocKeys) {
      const doc = docs[key];
      if (!doc) continue;
      const hasDoc = Boolean(doc.url || doc.publicId || (doc.status && doc.status !== "not_uploaded" && doc.status !== "missing"));
      doc.status = hasDoc ? doc.status || "pending" : "not_uploaded";
      let pubId = doc.publicId;
      let fmt = doc.format || "pdf";
      const resType = doc.resourceType || "image";
      if (!pubId && doc.url) {
        const ext = extractCloudinaryAssetInfo(doc.url);
        if (ext) { pubId = ext.publicId; fmt = ext.format; }
      }
      doc.viewUrl = canReviewDocuments && pubId && (pubId.includes("loadbalbin_kyc/") || pubId.includes("loadbalbin_profiles/"))
        ? generateSignedDocumentUrl(pubId, fmt, 300, resType)
        : null;
      doc.uploadedBy = doc.uploadedBy?.name || null;
      doc.reviewedBy = doc.reviewedBy?.name || null;
      delete doc.url;
      delete doc.publicId;
    }

    driverData.documents = docs;
    driverData.agency = driver.agency || null;
    driverData.canReviewDocuments = canReviewDocuments;

    return successResponse(res, {
      driver: driverData
    }, "Driver fetched");
  } catch (error) {
    console.error("Admin driver detail error:", error);
    return errorResponse(res, "Failed to fetch driver", 500);
  }
};

const updateApproval = (approvalStatus) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid driver ID", 400);
    const bodyKeys = Object.keys(req.body || {});
    if (approvalStatus === "rejected" || approvalStatus === "suspended") {
      const invalidKeys = bodyKeys.filter((k) => k !== "reason" && k !== "rejectionReason");
      if (invalidKeys.length > 0) {
        return errorResponse(res, "This action only accepts an optional reason field", 400);
      }
    } else {
      if (bodyKeys.length > 0) return errorResponse(res, "This action does not accept request fields", 400);
    }

    const updateDoc = { approvalStatus };
    if (approvalStatus === "approved") {
      const targetDriver = await Driver.findById(req.params.id).select("documents agency agencyAssociation").lean();
      if (!hasApprovedDriverIdentityDocuments(targetDriver)) {
        return errorResponse(res, "Both identity documents must be approved before approving this driver", 400);
      }
      if (targetDriver?.agency) {
        if (targetDriver.agencyAssociation?.status === "rejected") {
          return errorResponse(res, "Cannot approve driver: Agency has rejected the driver association", 400);
        }
        if (targetDriver.agencyAssociation?.status !== "approved") {
          return errorResponse(res, "Cannot approve driver: Agency association has not been accepted by the agency admin", 400);
        }
      }
    }
    if ((approvalStatus === "rejected" || approvalStatus === "suspended") && (req.body?.reason || req.body?.rejectionReason)) {
      updateDoc.rejectionReason = req.body?.reason || req.body?.rejectionReason;
    }
    if (approvalStatus === "suspended") {
      updateDoc.isOnline = false;
    }

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: updateDoc },
      { new: true, runValidators: true }
    ).populate("user", "name phone email profileImage");
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    return successResponse(res, {
      driver: safeDriver(driver, vehiclesByDriver.get(driver._id.toString()), isDesignatedSuperAdmin(req.user))
    }, `Driver ${approvalStatus}`);
  } catch (error) {
    console.error(`Admin driver ${approvalStatus} error:`, error);
    return errorResponse(res, `Failed to ${approvalStatus} driver`, 500);
  }
};

export const reviewAdminDriverDocument = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid driver ID", 400);
    if (!["idProof", "drivingLicense"].includes(req.params.docType)) {
      return errorResponse(res, "Invalid driver document type", 400);
    }
    if (!["approve", "reject"].includes(req.params.action)) {
      return errorResponse(res, "Invalid document review action", 400);
    }

    const bodyKeys = Object.keys(req.body || {});
    const allowedKeys = req.params.action === "reject" ? ["reason"] : [];
    if (bodyKeys.some((key) => !allowedKeys.includes(key))) {
      return errorResponse(res, "Invalid document review request", 400);
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (req.params.action === "reject" && (!reason || reason.length > 500)) {
      return errorResponse(res, "A rejection reason of 1 to 500 characters is required", 400);
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const document = driver.documents?.[req.params.docType];
    if (!document || (!document.publicId && !document.url)) {
      return errorResponse(res, "This document has not been submitted", 404);
    }
    const assetInfo = document.publicId
      ? { publicId: document.publicId }
      : extractCloudinaryAssetInfo(document.url);
    if (!assetInfo?.publicId?.startsWith("loadbalbin_kyc/")) {
      return errorResponse(res, "This document must be resubmitted to the private KYC vault before review", 409);
    }

    document.status = req.params.action === "approve" ? "approved" : "rejected";
    document.reviewedAt = new Date();
    document.reviewedBy = req.user._id;
    document.rejectionReason = req.params.action === "reject" ? reason : "";
    driver.markModified(`documents.${req.params.docType}`);
    await driver.save();

    return successResponse(res, {
      document: {
        status: document.status,
        submittedAt: document.submittedAt,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason
      }
    }, `Driver document ${document.status}`);
  } catch (error) {
    console.error("Admin driver document review failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to review driver document", 500);
  }
};

export const approveAdminDriver = updateApproval("approved");
export const rejectAdminDriver = updateApproval("rejected");
export const suspendAdminDriver = updateApproval("suspended");

export const updateAdminDriverStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return errorResponse(res, "Invalid driver ID", 400);
    const keys = Object.keys(req.body || {});
    if (keys.length !== 1 || keys[0] !== "isActive" || typeof req.body.isActive !== "boolean") {
      return errorResponse(res, "Only a boolean isActive value may be updated", 400);
    }
    const updateDoc = { isActive: req.body.isActive };
    if (!req.body.isActive) {
      updateDoc.isOnline = false;
    }
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: updateDoc },
      { new: true, runValidators: true }
    ).populate("user", "name phone email profileImage");
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    return successResponse(res, {
      driver: safeDriver(driver, vehiclesByDriver.get(driver._id.toString()), isDesignatedSuperAdmin(req.user))
    }, "Driver account status updated");
  } catch (error) {
    console.error("Admin driver status update error:", error);
    return errorResponse(res, "Failed to update driver status", 500);
  }
};
