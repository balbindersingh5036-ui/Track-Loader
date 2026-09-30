import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import { errorResponse, successResponse } from "../utils/response.js";

const vehicleTypes = Vehicle.schema.path("vehicleType").enumValues;
const bodyTypes = Vehicle.schema.path("bodyType").enumValues;
const capacityUnits = Vehicle.schema.path("loadCapacity.unit").enumValues;
const driverProjection = "fullName phone rating";
const vehicleFields = [
  "vehicleNumber",
  "vehicleModel",
  "vehicleType",
  "loadCapacity",
  "bodyType",
  "vehicleImage",
  "vehicleImages",
  "registrationDocument",
  "insuranceDocument",
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

  for (const field of [
    "vehicleImage",
    "registrationDocument",
    "insuranceDocument"
  ]) {
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
      body.vehicleImages.some((image) => typeof image !== "string")
    ) {
      return { error: "vehicleImages must be an array of strings" };
    }
    updates.vehicleImages = body.vehicleImages.map((image) => image.trim());
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
      .sort({ createdAt: -1 })
      .lean();
    return successResponse(res, { vehicles }, "Vehicles fetched successfully");
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
    return successResponse(res, { vehicle }, "Vehicle fetched successfully");
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
    return successResponse(res, { vehicles }, "Vehicles fetched successfully");
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
      { vehicles },
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
      { vehicle },
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
    return successResponse(res, { vehicle }, "Vehicle updated successfully");
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
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(search, "i");
      filter.$or = [
        { vehicleNumber: regex },
        { vehicleModel: regex }
      ];
    }

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate("driver", driverProjection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(filter)
    ]);

    return successResponse(
      res,
      {
        vehicles,
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
      .lean();
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(res, { vehicle }, "Vehicle fetched successfully");
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
    return successResponse(res, { vehicle }, "Vehicle updated successfully");
  } catch (error) {
    return handleError(res, error, "Update admin vehicle");
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

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: req.body.isActive } },
      { new: true, runValidators: true }
    );
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    return successResponse(
      res,
      { vehicle },
      "Vehicle status updated successfully"
    );
  } catch (error) {
    return handleError(res, error, "Update admin vehicle status");
  }
};
