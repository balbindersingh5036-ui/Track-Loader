import { successResponse, errorResponse } from "../utils/response.js";
import * as fareService from "../services/fareService.js";
import mongoose from "mongoose";

const CATEGORY_METADATA = {
  "mini-truck": { label: "Mini Truck", desc: "e.g. Tata Ace, Mahindra Jeeto (Up to 1.5 Tons)" },
  "pickup": { label: "Pickup Truck", desc: "e.g. Bolero Pik-Up, Dost (Up to 2.5 Tons)" },
  "small-truck": { label: "Small Truck", desc: "e.g. Tata 407, Eicher Pro 2049 (Up to 5 Tons)" },
  "medium-truck": { label: "Medium Truck", desc: "e.g. Eicher 17ft/19ft, BharatBenz 1217C (Up to 10 Tons)" },
  "large-truck": { label: "Large Heavy Truck", desc: "e.g. 10/12/14 Wheeler Multi-Axle (10+ Tons)" }
};

export const getFares = async (req, res) => {
  try {
    const enabled = await fareService.isFareEnabled();
    if (!enabled) {
      return errorResponse(res, "Fare system is currently disabled", 403);
    }

    const { vehicleType, vehicleId, vehicle } = req.query;
    const filter = { isActive: true };
    const typeOrId = vehicleType || vehicleId || vehicle;
    if (typeOrId) {
      const fare = await fareService.getFareByVehicleType(typeOrId);
      if (fare) {
        filter.vehicleType = fare.vehicleType;
      } else {
        filter.vehicleType = typeOrId;
      }
    }

    const fares = await fareService.getAllFares(filter);
    
    // Return authoritative 3-tier rates while maintaining legacy compatibility fields
    const publicFares = fares.map(f => ({
      vehicleType: f.vehicleType,
      perKmRate: f.perKmRate,
      perTonRate: f.perTonRate,
      minimumFare: f.minimumFare,
      baseFare: f.baseFare || 0,
      loadingCharge: f.loadingCharge || 0,
      unloadingCharge: f.unloadingCharge || 0
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
      return errorResponse(res, "Active fare not found for this vehicle", 404);
    }

    const publicFare = {
      vehicleType: fare.vehicleType,
      perKmRate: fare.perKmRate,
      perTonRate: fare.perTonRate,
      minimumFare: fare.minimumFare,
      baseFare: fare.baseFare || 0,
      loadingCharge: fare.loadingCharge || 0,
      unloadingCharge: fare.unloadingCharge || 0
    };

    return successResponse(res, { fare: publicFare }, "Fare fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch fare", 500);
  }
};

export const getFareQuotes = async (req, res) => {
  try {
    const enabled = await fareService.isFareEnabled();
    if (!enabled) {
      return errorResponse(res, "Fare system is currently disabled", 403);
    }

    const distanceKm = req.body?.distanceKm ?? req.query?.distanceKm;
    const weightValue = req.body?.weight?.value ?? req.body?.weightValue ?? req.query?.weightValue ?? req.query?.["weight[value]"];
    const weightUnit = req.body?.weight?.unit ?? req.body?.weightUnit ?? req.query?.weightUnit ?? req.query?.["weight[unit]"] ?? "kg";
    const vehicleType = req.body?.vehicleType ?? req.query?.vehicleType;

    if (distanceKm === undefined || distanceKm === null || distanceKm === "") {
      return errorResponse(res, "Distance in KM is required for fare quotation", 400);
    }

    if (weightValue === undefined || weightValue === null || weightValue === "") {
      return errorResponse(res, "Cargo weight value is required for fare quotation", 400);
    }

    const quotes = await fareService.calculateMultiVehicleFareQuotes({
      distanceKm,
      weightValue,
      weightUnit,
      vehicleType
    });

    return successResponse(res, {
      distanceKm: Number(distanceKm),
      quotes
    }, "Fare quotations generated successfully");
  } catch (error) {
    const statusCode = error.status || 500;
    return errorResponse(res, error.message || "Failed to calculate fare quotations", statusCode);
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

export const getFareVehicleCategories = async (req, res) => {
  try {
    const availableCategories = await fareService.getAvailableVehicleCategories();
    const existingFares = await fareService.getAllFares();

    const fareMap = new Map(existingFares.map(f => [f.vehicleType, f]));

    const categories = availableCategories.map(cat => {
      const existing = fareMap.get(cat);
      const meta = CATEGORY_METADATA[cat] || {
        label: cat.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        desc: `Vehicle category: ${cat}`
      };

      return {
        type: cat,
        label: meta.label,
        desc: meta.desc,
        hasFare: Boolean(existing),
        fareId: existing?._id || null,
        perKmRate: existing?.perKmRate ?? null,
        perTonRate: existing?.perTonRate ?? null,
        minimumFare: existing?.minimumFare ?? null,
        isActive: existing?.isActive ?? false,
        updatedAt: existing?.updatedAt || null,
        updatedBy: existing?.updatedBy || null
      };
    });

    return successResponse(res, { categories }, "Vehicle categories fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch vehicle categories", 500);
  }
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
    const {
      vehicleType,
      perKmRate,
      perTonRate,
      minimumFare,
      baseFare = 0,
      loadingCharge = 0,
      unloadingCharge = 0
    } = req.body;

    const availableCategories = await fareService.getAvailableVehicleCategories();
    if (!availableCategories.includes(vehicleType)) {
      return errorResponse(res, "Invalid vehicle type", 400);
    }

    if (!validateNumeric(perKmRate) || !validateNumeric(perTonRate) || !validateNumeric(minimumFare)) {
      return errorResponse(res, "Invalid numeric values. Must be >= 0 and finite.", 400);
    }

    if (!validateNumeric(baseFare) || !validateNumeric(loadingCharge) || !validateNumeric(unloadingCharge)) {
      return errorResponse(res, "Invalid numeric values. Must be >= 0 and finite.", 400);
    }

    const existingFares = await fareService.getAllFares({ vehicleType });
    if (existingFares.length > 0) {
      return errorResponse(res, "Fare already exists for this vehicle type", 409);
    }

    const fare = await fareService.createFare(
      {
        vehicleType,
        baseFare: Number(baseFare),
        perKmRate: Number(perKmRate),
        perTonRate: Number(perTonRate),
        minimumFare: Number(minimumFare),
        loadingCharge: Number(loadingCharge),
        unloadingCharge: Number(unloadingCharge)
      },
      req.user?._id || null
    );

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
      updateData.baseFare = Number(baseFare);
    }
    if (perKmRate !== undefined) {
      if (!validateNumeric(perKmRate)) return errorResponse(res, "Invalid perKmRate", 400);
      updateData.perKmRate = Number(perKmRate);
    }
    if (perTonRate !== undefined) {
      if (!validateNumeric(perTonRate)) return errorResponse(res, "Invalid perTonRate", 400);
      updateData.perTonRate = Number(perTonRate);
    }
    if (minimumFare !== undefined) {
      if (!validateNumeric(minimumFare)) return errorResponse(res, "Invalid minimumFare", 400);
      updateData.minimumFare = Number(minimumFare);
    }
    if (loadingCharge !== undefined) {
      if (!validateNumeric(loadingCharge)) return errorResponse(res, "Invalid loadingCharge", 400);
      updateData.loadingCharge = Number(loadingCharge);
    }
    if (unloadingCharge !== undefined) {
      if (!validateNumeric(unloadingCharge)) return errorResponse(res, "Invalid unloadingCharge", 400);
      updateData.unloadingCharge = Number(unloadingCharge);
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return errorResponse(res, "isActive must be boolean", 400);
      updateData.isActive = isActive;
    }

    const fare = await fareService.updateFare(id, updateData, req.user?._id || null);
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

    const fare = await fareService.updateFare(id, { isActive }, req.user?._id || null);
    if (!fare) return errorResponse(res, "Fare not found", 404);

    return successResponse(res, { fare }, "Fare status updated");
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
