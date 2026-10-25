import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { hasApprovedDriverIdentityDocuments } from "../utils/driverEligibility.js";
import { extractCloudinaryAssetInfo } from "../utils/documentSigner.js";
import { isDesignatedSuperAdmin } from "../utils/superAdmin.js";

const safeDriver = (driver, vehicles = []) => ({
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
  documents: {
    idProof: {
      status: driver.documents?.idProof?.url || driver.documents?.idProof?.publicId
        ? driver.documents.idProof.status || "pending"
        : "not_uploaded"
    },
    drivingLicense: {
      status: driver.documents?.drivingLicense?.url || driver.documents?.drivingLicense?.publicId
        ? driver.documents.drivingLicense.status || "pending"
        : "not_uploaded"
    }
  },
  vehicles: vehicles.map((vehicle) => ({
    id: vehicle._id,
    vehicleNumber: vehicle.vehicleNumber,
    vehicleModel: vehicle.vehicleModel,
    vehicleType: vehicle.vehicleType,
    loadCapacity: vehicle.loadCapacity,
    isAvailable: vehicle.isAvailable,
    isActive: vehicle.isActive
  }))
});

const loadVehiclesByDriver = async (drivers) => {
  const ids = drivers.map((driver) => driver._id);
  const vehicles = ids.length
    ? await Vehicle.find({ driver: { $in: ids } })
      .select("driver vehicleNumber vehicleModel vehicleType loadCapacity isAvailable isActive")
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
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const regex = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingUsers = await User.find({
        role: "driver",
        $or: [{ name: regex }, { phone: regex }, { email: regex }]
      }).select("_id").lean();
      query.$or = [
        { fullName: regex },
        { phone: regex },
        { email: regex },
        { user: { $in: matchingUsers.map((user) => user._id) } }
      ];
    }

    const [drivers, total] = await Promise.all([
      Driver.find(query).populate("user", "name phone email profileImage").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      Driver.countDocuments(query)
    ]);
    const vehiclesByDriver = await loadVehiclesByDriver(drivers);

    return successResponse(res, {
      drivers: drivers.map((driver) => safeDriver(driver, vehiclesByDriver.get(driver._id.toString()))),
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
      .populate("agency", "agencyName phone email address city")
      .populate("documents.idProof.uploadedBy", "name role")
      .populate("documents.idProof.reviewedBy", "name role")
      .populate("documents.drivingLicense.uploadedBy", "name role")
      .populate("documents.drivingLicense.reviewedBy", "name role")
      .lean();
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    const driverData = safeDriver(driver, vehiclesByDriver.get(driver._id.toString()));
    
    // Allow authorized admin in detail view to inspect driver KYC documents with short-lived signed URLs
    const docs = driver.documents ? JSON.parse(JSON.stringify(driver.documents)) : {};
    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    for (const key of ["idProof", "drivingLicense"]) {
      const doc = docs[key];
      if (!doc) continue;
      doc.status = doc.url || doc.publicId ? doc.status || "pending" : "not_uploaded";
      let pubId = doc.publicId;
      let fmt = doc.format || "pdf";
      const resType = doc.resourceType || "image";
      if (!pubId && doc.url) {
        const ext = extractCloudinaryAssetInfo(doc.url);
        if (ext) { pubId = ext.publicId; fmt = ext.format; }
      }
      docs[key].viewUrl = pubId?.startsWith("loadbalbin_kyc/")
        ? generateSignedDocumentUrl(pubId, fmt, 300, resType)
        : null;
      docs[key].uploadedBy = doc.uploadedBy?.name || null;
      docs[key].reviewedBy = doc.reviewedBy?.name || null;
      delete docs[key].url;
      delete docs[key].publicId;
    }

    driverData.documents = docs;
    driverData.agency = driver.agency || null;
    driverData.canReviewDocuments = isDesignatedSuperAdmin(req.user);

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
    if (approvalStatus === "rejected") {
      const invalidKeys = bodyKeys.filter((k) => k !== "reason" && k !== "rejectionReason");
      if (invalidKeys.length > 0) {
        return errorResponse(res, "This action only accepts an optional reason field", 400);
      }
    } else {
      if (bodyKeys.length > 0) return errorResponse(res, "This action does not accept request fields", 400);
    }

    const updateDoc = { approvalStatus };
    if (
      approvalStatus === "approved" &&
      !hasApprovedDriverIdentityDocuments(await Driver.findById(req.params.id).select("documents").lean())
    ) {
      return errorResponse(res, "Both identity documents must be approved before approving this driver", 400);
    }
    if (approvalStatus === "rejected" && (req.body?.reason || req.body?.rejectionReason)) {
      updateDoc.rejectionReason = req.body?.reason || req.body?.rejectionReason;
    }

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: updateDoc },
      { new: true, runValidators: true }
    ).populate("user", "name phone email profileImage");
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    return successResponse(res, {
      driver: safeDriver(driver, vehiclesByDriver.get(driver._id.toString()))
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
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true }
    ).populate("user", "name phone email profileImage");
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    return successResponse(res, {
      driver: safeDriver(driver, vehiclesByDriver.get(driver._id.toString()))
    }, "Driver account status updated");
  } catch (error) {
    console.error("Admin driver status update error:", error);
    return errorResponse(res, "Failed to update driver status", 500);
  }
};
