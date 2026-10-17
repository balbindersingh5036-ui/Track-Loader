import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";

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
      .lean();
    if (!driver) return errorResponse(res, "Driver not found", 404);
    const vehiclesByDriver = await loadVehiclesByDriver([driver]);
    const driverData = safeDriver(driver, vehiclesByDriver.get(driver._id.toString()));
    
    // Allow authorized admin in detail view to inspect driver KYC documents with short-lived signed URLs
    const docs = driver.documents ? JSON.parse(JSON.stringify(driver.documents)) : {};
    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    for (const [key, doc] of Object.entries(docs)) {
      if (doc && (doc.publicId || doc.url)) {
        let pubId = doc.publicId;
        let fmt = doc.format || "pdf";
        let resType = doc.resourceType || "image";
        if (!pubId && doc.url) {
          const ext = extractCloudinaryAssetInfo(doc.url);
          if (ext) { pubId = ext.publicId; fmt = ext.format; }
        }
        if (pubId) {
          docs[key].viewUrl = generateSignedDocumentUrl(pubId, fmt, 300, resType);
        } else {
          docs[key].viewUrl = doc.url;
        }
      }
    }

    driverData.documents = docs;
    driverData.agency = driver.agency || null;

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
