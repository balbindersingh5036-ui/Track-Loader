import { successResponse, errorResponse } from "../utils/response.js";
import * as fareService from "../services/fareService.js";
import mongoose from "mongoose";

const validVehicleTypes = [
  "mini-truck",
  "pickup",
  "small-truck",
  "medium-truck",
  "large-truck"
];

export const getFares = async (req, res) => {
  try {
    const enabled = await fareService.isFareEnabled();
    if (!enabled) {
      return errorResponse(res, "Fare system is currently disabled", 403);
    }

    const { vehicleType } = req.query;
    const filter = { isActive: true };
    if (vehicleType) {
      filter.vehicleType = vehicleType;
    }

    const fares = await fareService.getAllFares(filter);
    
    // Do not expose admin/internal metadata unnecessarily
    const publicFares = fares.map(f => ({
      vehicleType: f.vehicleType,
      baseFare: f.baseFare,
      perKmRate: f.perKmRate,
      perTonRate: f.perTonRate,
      minimumFare: f.minimumFare,
      loadingCharge: f.loadingCharge,
      unloadingCharge: f.unloadingCharge
    }));

    return successResponse(res, { fares: publicFares }, "Active fares fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch fares", 500);
  }
};

export const getFareByVehicleType = async (req, res) => {
  try {
    const enabled = await fareService.isFareEnabled();
    if (!enabled) {
      return errorResponse(res, "Fare system is currently disabled", 403);
    }

    const { vehicleType } = req.params;

    const fare = await fareService.getFareByVehicleType(vehicleType);
    
    if (!fare) {
      return errorResponse(res, "Active fare not found for this vehicle type", 404);
    }

    const publicFare = {
      vehicleType: fare.vehicleType,
      baseFare: fare.baseFare,
      perKmRate: fare.perKmRate,
      perTonRate: fare.perTonRate,
      minimumFare: fare.minimumFare,
      loadingCharge: fare.loadingCharge,
      unloadingCharge: fare.unloadingCharge
    };

    return successResponse(res, { fare: publicFare }, "Fare fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch fare", 500);
  }
};

// Admin Controllers

const validateNumeric = (val, min = 0) => {
  if (
    (typeof val !== "number" && typeof val !== "string") ||
    (typeof val === "string" && !val.trim())
  ) {
    return false;
  }

  const num = Number(val);
  return Number.isFinite(num) && num >= min;
};

export const adminGetFares = async (req, res) => {
  try {
    const fares = await fareService.getAllFares();
    return successResponse(res, { fares }, "Fares fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch fares", 500);
  }
};

export const adminGetFareById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const fare = await fareService.getFareById(id);
    if (!fare) return errorResponse(res, "Fare not found", 404);

    return successResponse(res, { fare }, "Fare fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch fare", 500);
  }
};

export const adminCreateFare = async (req, res) => {
  try {
    const { vehicleType, baseFare, perKmRate, perTonRate, minimumFare, loadingCharge, unloadingCharge } = req.body;
    
    if (!validVehicleTypes.includes(vehicleType)) {
      return errorResponse(res, "Invalid vehicle type", 400);
    }

    if (!validateNumeric(baseFare) || !validateNumeric(perKmRate) || !validateNumeric(perTonRate) || 
        !validateNumeric(minimumFare) || !validateNumeric(loadingCharge) || !validateNumeric(unloadingCharge)) {
      return errorResponse(res, "Invalid numeric values. Must be >= 0 and finite.", 400);
    }

    const existingFares = await fareService.getAllFares({ vehicleType });
    if (existingFares.length > 0) {
      return errorResponse(res, "Fare already exists for this vehicle type", 409);
    }

    const fare = await fareService.createFare({
      vehicleType, baseFare, perKmRate, perTonRate, minimumFare, loadingCharge, unloadingCharge
    });

    return successResponse(res, { fare }, "Fare created", 201);
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, "Fare already exists for this vehicle type", 409);
    }
    return errorResponse(res, "Failed to create fare", 500);
  }
};

export const adminUpdateFare = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const { baseFare, perKmRate, perTonRate, minimumFare, loadingCharge, unloadingCharge, isActive } = req.body;
    
    const updateData = {};
    
    if (baseFare !== undefined) {
      if (!validateNumeric(baseFare)) return errorResponse(res, "Invalid baseFare", 400);
      updateData.baseFare = baseFare;
    }
    if (perKmRate !== undefined) {
      if (!validateNumeric(perKmRate)) return errorResponse(res, "Invalid perKmRate", 400);
      updateData.perKmRate = perKmRate;
    }
    if (perTonRate !== undefined) {
      if (!validateNumeric(perTonRate)) return errorResponse(res, "Invalid perTonRate", 400);
      updateData.perTonRate = perTonRate;
    }
    if (minimumFare !== undefined) {
      if (!validateNumeric(minimumFare)) return errorResponse(res, "Invalid minimumFare", 400);
      updateData.minimumFare = minimumFare;
    }
    if (loadingCharge !== undefined) {
      if (!validateNumeric(loadingCharge)) return errorResponse(res, "Invalid loadingCharge", 400);
      updateData.loadingCharge = loadingCharge;
    }
    if (unloadingCharge !== undefined) {
      if (!validateNumeric(unloadingCharge)) return errorResponse(res, "Invalid unloadingCharge", 400);
      updateData.unloadingCharge = unloadingCharge;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return errorResponse(res, "isActive must be boolean", 400);
      updateData.isActive = isActive;
    }

    const fare = await fareService.updateFare(id, updateData);
    if (!fare) return errorResponse(res, "Fare not found", 404);

    return successResponse(res, { fare }, "Fare updated");
  } catch (error) {
    return errorResponse(res, "Failed to update fare", 500);
  }
};

export const adminToggleFareStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return errorResponse(res, "isActive must be a boolean", 400);
    }

    const fare = await fareService.updateFare(id, { isActive });
    if (!fare) return errorResponse(res, "Fare not found", 404);

    return successResponse(res, { fare }, `Fare status updated`);
  } catch (error) {
    return errorResponse(res, "Failed to update fare status", 500);
  }
};

export const adminDeleteFare = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const fare = await fareService.deleteFare(id);
    if (!fare) return errorResponse(res, "Fare not found", 404);

    return successResponse(res, null, "Fare deleted");
  } catch (error) {
    if (error.status === 409) {
      return errorResponse(res, error.message, 409);
    }
    return errorResponse(res, "Failed to delete fare", 500);
  }
};
