import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Agency from "../models/Agency.js";
import Booking from "../models/Booking.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";
import { extractCloudinaryAssetInfo } from "../utils/documentSigner.js";
import { isDesignatedSuperAdmin } from "../utils/superAdmin.js";
import { checkDriverAssignableToVehicle } from "../utils/driverEligibility.js";

const vehicleTypes = Vehicle.schema.path("vehicleType").enumValues;
const bodyTypes = Vehicle.schema.path("bodyType").enumValues;
const capacityUnits = Vehicle.schema.path("loadCapacity.unit").enumValues;
const driverProjection = "fullName phone rating approvalStatus isActive agencyAssociation.status documents.idProof.status documents.drivingLicense.status";
const agencyPopulate = {
  path: "agency",
  select: "agencyName phone email approvalStatus isActive owner",
  populate: { path: "owner", select: "name phone role" }
};
const uploadedWithoutStatus = (documentPath) => ({
  $and: [
    { [`${documentPath}.status`]: { $exists: false } },
    { $or: [
      { [`${documentPath}.url`]: { $exists: true, $nin: ["", null] } },
      { [`${documentPath}.publicId`]: { $exists: true, $nin: ["", null] } }
    ] }
  ]
});
const pendingDocumentFilter = (documentPath) => ({
  $or: [
    { [`${documentPath}.status`]: "pending" },
    uploadedWithoutStatus(documentPath)
  ]
});
const vehicleFields = [
  "vehicleNumber",
  "vehicleModel",
  "vehicleType",
  "loadCapacity",
  "bodyType",
  "vehicleImage",
  "vehicleImages",
  "isAvailable"
];
const driverEditableFields = vehicleFields.filter(
  (field) => field !== "isAvailable"
);

const handleError = (res, error, action) => {
  console.error(`${action} error:`, error);

  if (error?.code === 11000) {
    return errorResponse(res, "Vehicle number is already registered", 409);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return errorResponse(res, error.message, 400);
  }

  if (error instanceof mongoose.Error.CastError) {
    return errorResponse(res, "Invalid vehicle data", 400);
  }

  return errorResponse(res, `${action} failed`, 500);
};

const validObjectId = (id) => mongoose.isValidObjectId(id);
const toVehicleObject = (vehicle) =>
  typeof vehicle?.toObject === "function" ? vehicle.toObject() : vehicle;

const parseVehicleUpdates = (body, { creating = false, allowedFields }) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A vehicle object is required" };
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.includes(field)
  );
  if (unknownFields.length) {
    return { error: `Unsupported vehicle field: ${unknownFields[0]}` };
  }

  const requiredFields = creating
    ? [
        "vehicleNumber",
        "vehicleModel",
        "vehicleType",
        "loadCapacity",
        "bodyType"
      ]
    : [];
  for (const field of requiredFields) {
    if (!Object.hasOwn(body, field)) {
      return { error: `${field} is required` };
    }
  }

  const updates = {};
  if (Object.hasOwn(body, "vehicleNumber")) {
    if (typeof body.vehicleNumber !== "string" || !body.vehicleNumber.trim()) {
      return { error: "Vehicle number must be a non-empty string" };
    }
    updates.vehicleNumber = body.vehicleNumber.trim().toUpperCase();
  }

  if (Object.hasOwn(body, "vehicleModel")) {
    if (typeof body.vehicleModel !== "string" || !body.vehicleModel.trim()) {
      return { error: "Vehicle model must be a non-empty string" };
    }
    updates.vehicleModel = body.vehicleModel.trim();
  }

  if (Object.hasOwn(body, "vehicleType")) {
    if (
      typeof body.vehicleType !== "string" ||
      !vehicleTypes.includes(body.vehicleType)
    ) {
      return { error: "Invalid vehicle type" };
    }
    updates.vehicleType = body.vehicleType;
  }

  if (Object.hasOwn(body, "loadCapacity")) {
    const capacity = body.loadCapacity;
    if (
      !capacity ||
      typeof capacity !== "object" ||
      Array.isArray(capacity) ||
      typeof capacity.value !== "number" ||
      !Number.isFinite(capacity.value) ||
      capacity.value < 0 ||
      typeof capacity.unit !== "string" ||
      !capacityUnits.includes(capacity.unit)
    ) {
      return {
        error: "Load capacity needs a non-negative numeric value and valid unit"
      };
    }
    updates.loadCapacity = {
      value: capacity.value,
      unit: capacity.unit
    };
  } else if (creating) {
    return { error: "loadCapacity is required" };
  }

  if (Object.hasOwn(body, "bodyType")) {
    if (typeof body.bodyType !== "string" || !bodyTypes.includes(body.bodyType)) {
      return { error: "Invalid body type" };
    }
    updates.bodyType = body.bodyType;
  }

  for (const field of ["vehicleImage"]) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== "string") {
        return { error: `${field} must be a string` };
      }
      updates[field] = body[field].trim();
    }
  }

  if (Object.hasOwn(body, "vehicleImages")) {
    if (
      !Array.isArray(body.vehicleImages) ||
      body.vehicleImages.length > 4 ||
      body.vehicleImages.some((image) => typeof image !== "string")
    ) {
      return { error: "vehicleImages must be an array of no more than 4 strings" };
    }
    updates.vehicleImages = body.vehicleImages.map((image) => image.trim());
    updates.vehicleImage = updates.vehicleImages[0] || "";
  }

  if (Object.hasOwn(body, "isAvailable")) {
    if (typeof body.isAvailable !== "boolean") {
      return { error: "isAvailable must be a boolean" };
    }
    updates.isAvailable = body.isAvailable;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "At least one vehicle field is required" };
  }

  return { updates };
};

const getDriverForUser = (userId) => Driver.findOne({ user: userId });

export const getVehicles = async (req, res) => {
  try {
    const filter = { isActive: true, isAvailable: true };
    const { vehicleType, minCapacity, maxCapacity } = req.query;

    if (vehicleType !== undefined) {
      if (
        typeof vehicleType !== "string" ||
        !vehicleTypes.includes(vehicleType)
      ) {
        return errorResponse(res, "Invalid vehicle type", 400);
      }
      filter.vehicleType = vehicleType;
    }

    const capacityFilter = {};
    if (minCapacity !== undefined) {
      if (typeof minCapacity !== "string" || !minCapacity.trim()) {
        return errorResponse(res, "minCapacity must be a non-negative number", 400);
      }
      const min = Number(minCapacity);
      if (!Number.isFinite(min) || min < 0) {
        return errorResponse(res, "minCapacity must be a non-negative number", 400);
      }
      capacityFilter.$gte = min;
    }
    if (maxCapacity !== undefined) {
      if (typeof maxCapacity !== "string" || !maxCapacity.trim()) {
        return errorResponse(res, "maxCapacity must be a non-negative number", 400);
      }
      const max = Number(maxCapacity);
      if (!Number.isFinite(max) || max < 0) {
        return errorResponse(res, "maxCapacity must be a non-negative number", 400);
      }
      capacityFilter.$lte = max;
    }
    if (
      capacityFilter.$gte !== undefined &&
      capacityFilter.$lte !== undefined &&
      capacityFilter.$gte > capacityFilter.$lte
    ) {
      return errorResponse(res, "minCapacity cannot exceed maxCapacity", 400);
    }
    if (Object.keys(capacityFilter).length) {
      filter["loadCapacity.value"] = capacityFilter;
    }

    const vehicles = await Vehicle.find(filter)
      .populate("driver", driverProjection)
      .populate("agency", "agencyName approvalStatus isActive")
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(res, {
      vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle))
    }, "Vehicles fetched successfully");
  } catch (error) {
    return handleError(res, error, "Fetch vehicles");
  }
};

export const getVehicleById = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }

    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      isActive: true
    })
      .populate("driver", driverProjection)
      .lean();
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(res, {
      vehicle: sanitizeVehicleDocumentResponse(vehicle)
    }, "Vehicle fetched successfully");
  } catch (error) {
    return handleError(res, error, "Fetch vehicle");
  }
};

export const getVehiclesByType = async (req, res) => {
  try {
    const { vehicleType } = req.params;
    if (!vehicleTypes.includes(vehicleType)) {
      return errorResponse(res, "Invalid vehicle type", 400);
    }

    const vehicles = await Vehicle.find({
      vehicleType,
      isActive: true,
      isAvailable: true
    })
      .populate("driver", driverProjection)
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(res, {
      vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle))
    }, "Vehicles fetched successfully");
  } catch (error) {
    return handleError(res, error, "Fetch vehicles by type");
  }
};

export const getDriverVehicles = async (req, res) => {
  try {
    const driver = await getDriverForUser(req.user._id);
    if (!driver) {
      return errorResponse(res, "Driver profile not found", 404);
    }

    const vehicles = await Vehicle.find({ driver: driver._id })
      .populate("driver", driverProjection)
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(
      res,
      { vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle)) },
      "Driver vehicles fetched successfully"
    );
  } catch (error) {
    return handleError(res, error, "Fetch driver vehicles");
  }
};

export const createDriverVehicle = async (req, res) => {
  try {
    const parsed = parseVehicleUpdates(req.body, {
      creating: true,
      allowedFields: driverEditableFields
    });
    if (parsed.error) {
      return errorResponse(res, parsed.error, 400);
    }

    const driver = await getDriverForUser(req.user._id);
    if (!driver) {
      return errorResponse(res, "Driver profile not found", 404);
    }

    const vehicle = await Vehicle.create({
      ...parsed.updates,
      driver: driver._id
    });
    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toVehicleObject(vehicle)) },
      "Vehicle added successfully",
      201
    );
  } catch (error) {
    return handleError(res, error, "Add driver vehicle");
  }
};

export const updateDriverVehicle = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    const parsed = parseVehicleUpdates(req.body, {
      allowedFields: driverEditableFields
    });
    if (parsed.error) {
      return errorResponse(res, parsed.error, 400);
    }

    const driver = await getDriverForUser(req.user._id);
    if (!driver) {
      return errorResponse(res, "Driver profile not found", 404);
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, driver: driver._id },
      { $set: parsed.updates },
      { new: true, runValidators: true }
    );
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(res, {
      vehicle: sanitizeVehicleDocumentResponse(toVehicleObject(vehicle))
    }, "Vehicle updated successfully");
  } catch (error) {
    return handleError(res, error, "Update driver vehicle");
  }
};

export const updateDriverVehicleStatus = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    if (typeof req.body?.isAvailable !== "boolean") {
      return errorResponse(res, "isAvailable must be a boolean", 400);
    }

    const driver = await getDriverForUser(req.user._id);
    if (!driver) {
      return errorResponse(res, "Driver profile not found", 404);
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, driver: driver._id },
      { $set: { isAvailable: req.body.isAvailable } },
      { new: true, runValidators: true }
    );
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(
      res,
      { vehicle },
      "Vehicle availability updated successfully"
    );
  } catch (error) {
    return handleError(res, error, "Update driver vehicle availability");
  }
};

export const getAdminVehicles = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (
      (req.query.page !== undefined &&
        (typeof req.query.page !== "string" || !req.query.page.trim())) ||
      (req.query.limit !== undefined &&
        (typeof req.query.limit !== "string" || !req.query.limit.trim())) ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return errorResponse(res, "page and limit must be valid integers (limit max 100)", 400);
    }

    const filter = {};
    const searchParam = req.query.search;
    if (searchParam !== undefined && typeof searchParam !== "string") {
      return errorResponse(res, "search must be a string", 400);
    }
    if (searchParam?.trim()) {
      const regex = new RegExp(searchParam.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const [drivers, agencies] = await Promise.all([
        Driver.find({ $or: [{ fullName: regex }, { phone: regex }] }).select("_id").lean(),
        Agency.find({ $or: [{ agencyName: regex }, { phone: regex }, { email: regex }] }).select("_id").lean()
      ]);
      filter.$or = [
        { vehicleNumber: regex },
        { vehicleModel: regex },
        { vehicleType: regex },
        { driver: { $in: drivers.map((driver) => driver._id) } },
        { agency: { $in: agencies.map((agency) => agency._id) } }
      ];
    }

    if (req.query.status !== undefined) {
      if (!["active", "inactive"].includes(req.query.status)) {
        return errorResponse(res, "status must be active or inactive", 400);
      }
      filter.isActive = req.query.status === "active";
    }
    if (req.query.assigned !== undefined) {
      if (!["true", "false"].includes(req.query.assigned)) {
        return errorResponse(res, "assigned must be true or false", 400);
      }
      filter.driver = req.query.assigned === "true"
        ? { $exists: true, $ne: null }
        : null;
    }
    if (req.query.availability !== undefined) {
      if (!["true", "false"].includes(req.query.availability)) {
        return errorResponse(res, "availability must be true or false", 400);
      }
      filter.isAvailable = req.query.availability === "true";
    }
    if (req.query.vehicleType !== undefined) {
      if (!vehicleTypes.includes(req.query.vehicleType)) {
        return errorResponse(res, "Invalid vehicle category", 400);
      }
      filter.vehicleType = req.query.vehicleType;
    }
    for (const [queryKey, documentKey] of [
      ["registrationStatus", "registration"],
      ["insuranceStatus", "insurance"]
    ]) {
      const value = req.query[queryKey];
      if (value !== undefined) {
        const status = value === "missing" ? "not_uploaded" : value;
        if (!["not_uploaded", "pending", "approved", "rejected"].includes(status)) {
          return errorResponse(res, `Invalid ${queryKey}`, 400);
        }
        if (status === "not_uploaded") {
          filter.$and = [
            ...(filter.$and || []),
            { $or: [
              { [`documents.${documentKey}.status`]: "not_uploaded" },
              { [`documents.${documentKey}.status`]: { $exists: false } },
              {
                [`documents.${documentKey}.url`]: { $in: ["", null] },
                [`documents.${documentKey}.publicId`]: { $in: ["", null] }
              }
            ] }
          ];
        } else if (status === "pending") {
          filter.$and = [
            ...(filter.$and || []),
            pendingDocumentFilter(`documents.${documentKey}`)
          ];
        } else {
          filter[`documents.${documentKey}.status`] = status;
        }
      }
    }
    if (req.query.documentStatus !== undefined) {
      if (req.query.documentStatus !== "rejected") {
        return errorResponse(res, "Invalid documentStatus", 400);
      }
      filter.$and = [
        ...(filter.$and || []),
        { $or: [
          { "documents.registration.status": "rejected" },
          { "documents.insurance.status": "rejected" }
        ] }
      ];
    }

    const sortFields = {
      vehicleNumber: "vehicleNumber",
      vehicleModel: "vehicleModel",
      createdAt: "createdAt"
    };
    const sortBy = req.query.sortBy ?? "createdAt";
    const sortOrder = req.query.sortOrder ?? "desc";
    if (!Object.hasOwn(sortFields, sortBy) || !["asc", "desc"].includes(sortOrder)) {
      return errorResponse(res, "Invalid vehicle sort option", 400);
    }
    const sort = { [sortFields[sortBy]]: sortOrder === "asc" ? 1 : -1 };
    const statusCounts = await Promise.all([
      Vehicle.countDocuments({}),
      Vehicle.countDocuments({ isActive: true }),
      Vehicle.countDocuments({ isActive: false }),
      Vehicle.countDocuments({ isAvailable: true }),
      Vehicle.countDocuments({ driver: { $exists: true, $ne: null } }),
      Vehicle.countDocuments(pendingDocumentFilter("documents.registration")),
      Vehicle.countDocuments(pendingDocumentFilter("documents.insurance")),
      Vehicle.countDocuments({ "documents.registration.status": "rejected" }),
      Vehicle.countDocuments({
        "documents.insurance.status": "rejected"
      })
    ]);
    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate("driver", driverProjection)
        .populate(agencyPopulate)
        .populate("documents.registration.uploadedBy", "name")
        .populate("documents.insurance.uploadedBy", "name")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(filter)
    ]);

    return successResponse(
      res,
      {
        vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle)),
        stats: {
          total: statusCounts[0],
          active: statusCounts[1],
          inactive: statusCounts[2],
          available: statusCounts[3],
          assigned: statusCounts[4],
          pendingRegistration: statusCounts[5],
          pendingInsurance: statusCounts[6],
          rejectedDocuments: statusCounts[7] + statusCounts[8]
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      "Vehicles fetched successfully"
    );
  } catch (error) {
    return handleError(res, error, "Fetch admin vehicles");
  }
};

export const getAdminVehicleById = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    const vehicle = await Vehicle.findById(req.params.id)
      .populate("driver", driverProjection)
      .populate(agencyPopulate)
      .populate("documents.registration.uploadedBy", "name")
      .populate("documents.registration.reviewedBy", "name")
      .populate("documents.registration.reviewHistory.reviewedBy", "name")
      .populate("documents.insurance.uploadedBy", "name")
      .populate("documents.insurance.reviewedBy", "name")
      .populate("documents.insurance.reviewHistory.reviewedBy", "name")
      .lean();
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(res, {
      vehicle: {
        ...sanitizeVehicleDocumentResponse(vehicle),
        canReviewDocuments: isDesignatedSuperAdmin(req.user),
        canViewDocuments: isDesignatedSuperAdmin(req.user)
      }
    }, "Vehicle fetched successfully");
  } catch (error) {
    return handleError(res, error, "Fetch admin vehicle");
  }
};

export const updateAdminVehicle = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    const parsed = parseVehicleUpdates(req.body, {
      allowedFields: vehicleFields
    });
    if (parsed.error) {
      return errorResponse(res, parsed.error, 400);
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.updates },
      { new: true, runValidators: true }
    );
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(res, {
      vehicle: sanitizeVehicleDocumentResponse(toVehicleObject(vehicle))
    }, "Vehicle updated successfully");
  } catch (error) {
    return handleError(res, error, "Update admin vehicle");
  }
};

export const reviewAdminVehicleDocument = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) return errorResponse(res, "Invalid vehicle ID", 400);
    if (!["registration", "insurance"].includes(req.params.docType)) {
      return errorResponse(res, "Invalid vehicle document type", 400);
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

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return errorResponse(res, "Vehicle not found", 404);
    const document = vehicle.documents?.[req.params.docType];
    if (!document || (!document.publicId && !document.url)) {
      return errorResponse(res, "This document has not been submitted", 404);
    }
    const assetInfo = document.publicId
      ? { publicId: document.publicId }
      : extractCloudinaryAssetInfo(document.url);
    if (!assetInfo?.publicId?.startsWith("loadbalbin_kyc/")) {
      return errorResponse(res, "This document must be resubmitted to the private KYC vault before review", 409);
    }

    const previousStatus = document.status || "pending";
    if (previousStatus !== "pending") {
      return errorResponse(res, "Only pending vehicle documents can be reviewed", 409);
    }
    const reviewedAt = new Date();
    document.status = req.params.action === "approve" ? "approved" : "rejected";
    document.reviewedAt = reviewedAt;
    document.reviewedBy = req.user._id;
    document.rejectionReason = req.params.action === "reject" ? reason : "";
    if (!Array.isArray(document.reviewHistory)) document.reviewHistory = [];
    document.reviewHistory.push({
      previousStatus,
      newStatus: document.status,
      reviewedAt,
      reviewedBy: req.user._id,
      rejectionReason: document.rejectionReason
    });
    vehicle.markModified(`documents.${req.params.docType}`);
    await vehicle.save();

    return successResponse(res, {
      document: {
        status: document.status,
        submittedAt: document.submittedAt,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason
      }
    }, `Vehicle document ${document.status}`);
  } catch (error) {
    console.error("Admin vehicle document review failed:", error.code || error.name || "unknown error");
    return errorResponse(res, "Failed to review vehicle document", 500);
  }
};

export const updateAdminVehicleStatus = async (req, res) => {
  try {
    if (!validObjectId(req.params.id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    if (typeof req.body?.isActive !== "boolean") {
      return errorResponse(res, "isActive must be a boolean", 400);
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    if (vehicle.isActive === req.body.isActive) {
      return successResponse(
        res,
        { vehicle: sanitizeVehicleDocumentResponse(toVehicleObject(vehicle)) },
        "Vehicle status is unchanged"
      );
    }

    const activeBooking = await Booking.exists({
      vehicle: vehicle._id,
      $or: [
        { bookingStatus: { $in: ["accepted", "in-progress"] } },
        { assignmentStatus: { $in: ["pending_acceptance", "accepted"] } }
      ]
    });
    if (activeBooking) {
      return errorResponse(res, "Vehicle status cannot change while it has an active booking or assignment", 409);
    }

    if (!req.body.isActive && vehicle.driver) {
      return errorResponse(res, "Unassign the driver before deactivating this vehicle", 409);
    }

    if (req.body.isActive) {
      if (!vehicle.documents?.registration || !vehicle.documents?.insurance ||
        vehicle.documents.registration.status !== "approved" ||
        vehicle.documents.insurance.status !== "approved") {
        return errorResponse(res, "RC and Insurance must both be approved before vehicle activation", 409);
      }

      let agency = null;
      if (vehicle.agency) {
        agency = await Agency.findById(vehicle.agency);
        if (!agency || agency.approvalStatus !== "approved" || !agency.isActive) {
          return errorResponse(res, "The vehicle's Agency must be active and approved before activation", 409);
        }
      }

      if (vehicle.driver) {
        const driver = await Driver.findById(vehicle.driver);
        if (!driver) {
          return errorResponse(res, "The assigned Driver profile is missing; resolve the assignment before activation", 409);
        }
        const assignment = checkDriverAssignableToVehicle(
          driver,
          { ...toVehicleObject(vehicle), isActive: true },
          agency
        );
        if (!assignment.eligible) {
          return errorResponse(res, assignment.message, 409);
        }
      }
    }

    vehicle.isActive = req.body.isActive;
    await vehicle.save();
    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toVehicleObject(vehicle)) },
      "Vehicle status updated successfully"
    );
  } catch (error) {
    return handleError(res, error, "Update admin vehicle status");
  }
};
