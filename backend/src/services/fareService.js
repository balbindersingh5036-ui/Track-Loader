import mongoose from "mongoose";
import Fare from "../models/Fare.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import { isSettingEnabled } from "./systemSettingService.js";
import {
  getCategoryEnabledSettingKey,
  getServiceCategoryForVehicleType,
  SERVICE_CATEGORIES,
  VEHICLE_TYPES_BY_CATEGORY
} from "../utils/vehicleCategories.js";

const fareCache = new Map();

export const isFareEnabled = async () => {
  return await isSettingEnabled("fare.enabled");
};

export const clearFareCache = () => {
  fareCache.clear();
};

export const getAvailableVehicleCategories = async () => {
  const schemaEnums = Vehicle.schema.path("vehicleType")?.enumValues || [];
  let distinctTypes = [];
  if (mongoose.connection.readyState === 1) {
    try {
      distinctTypes = await Vehicle.distinct("vehicleType");
    } catch (err) {
      // Fallback gracefully if database is unavailable
    }
  }
  const merged = Array.from(new Set([...schemaEnums, ...distinctTypes.filter(Boolean)]));
  return merged;
};

export const getAllFares = async (filter = {}) => {
  return Fare.find(filter).populate("updatedBy", "name email").lean();
};

export const getFareByVehicleType = async (vehicleTypeOrId) => {
  if (!vehicleTypeOrId) return null;

  let targetType = vehicleTypeOrId;
  if (mongoose.Types.ObjectId.isValid(vehicleTypeOrId)) {
    const vehicle = await Vehicle.findById(vehicleTypeOrId).lean();
    if (vehicle) {
      targetType = vehicle.vehicleType;
    }
  }

  const query = Fare.findOne({ vehicleType: targetType, isActive: true });
  const fare = await (typeof query?.lean === "function" ? query.lean() : query);
  return fare;
};

export const getFareById = async (id) => {
  return Fare.findById(id).populate("updatedBy", "name email").lean();
};

export const createFare = async (data, createdBy = null) => {
  const payload = { ...data };
  if (createdBy) {
    payload.updatedBy = createdBy;
    payload.history = [
      {
        perKmRate: Number(data.perKmRate),
        perTonRate: Number(data.perTonRate || 0),
        minimumFare: Number(data.minimumFare),
        loadingCharge: Number(data.loadingCharge || 0),
        unloadingCharge: Number(data.unloadingCharge || 0),
        waitingCharge: Number(data.waitingCharge || 0),
        extraDistanceCharge: Number(data.extraDistanceCharge || 0),
        updatedBy: createdBy,
        updatedAt: new Date()
      }
    ];
  }
  const fare = new Fare(payload);
  await fare.save();
  clearFareCache();
  return fare;
};

export const updateFare = async (id, data, updatedBy = null) => {
  const current = await Fare.findById(id);
  if (!current) return null;

  const updatePayload = { ...data };
  if (updatedBy) {
    updatePayload.updatedBy = updatedBy;
  }

  // Record history when rate fields are modified
  if (
    data.perKmRate !== undefined ||
    data.perTonRate !== undefined ||
    data.minimumFare !== undefined ||
    data.loadingCharge !== undefined ||
    data.unloadingCharge !== undefined ||
    data.waitingCharge !== undefined ||
    data.extraDistanceCharge !== undefined
  ) {
    const historyEntry = {
      perKmRate: data.perKmRate !== undefined ? Number(data.perKmRate) : current.perKmRate,
      perTonRate: data.perTonRate !== undefined ? Number(data.perTonRate) : current.perTonRate,
      minimumFare: data.minimumFare !== undefined ? Number(data.minimumFare) : current.minimumFare,
      loadingCharge: data.loadingCharge !== undefined ? Number(data.loadingCharge) : current.loadingCharge,
      unloadingCharge: data.unloadingCharge !== undefined ? Number(data.unloadingCharge) : current.unloadingCharge,
      waitingCharge: data.waitingCharge !== undefined ? Number(data.waitingCharge) : current.waitingCharge,
      extraDistanceCharge: data.extraDistanceCharge !== undefined
        ? Number(data.extraDistanceCharge)
        : current.extraDistanceCharge,
      updatedBy: updatedBy || null,
      updatedAt: new Date()
    };
    updatePayload.$push = { history: historyEntry };
  }

  const fare = await Fare.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true
  }).populate("updatedBy", "name email");

  clearFareCache();
  return fare;
};

export const deleteFare = async (id) => {
  const fare = await Fare.findById(id);
  if (!fare) return null;

  const activeBookings = await Booking.countDocuments({
    vehicleType: fare.vehicleType,
    bookingStatus: { $in: ["pending", "accepted", "in-progress"] }
  });

  if (activeBookings > 0) {
    const error = new Error("Fare is currently used by active bookings. Deactivate it instead.");
    error.status = 409;
    throw error;
  }

  await Fare.findByIdAndDelete(id);
  clearFareCache();
  return fare;
};

const toFiniteNumber = (value) => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return NaN;
  }

  return Number(value);
};

export const calculateFareBreakdown = async ({
  vehicleType,
  distanceKm,
  weightValue,
  weightUnit,
  loadingRequired = false,
  unloadingRequired = false,
  waitingMinutes = 0,
  extraDistanceKm = 0
}) => {
  const numericDistance = toFiniteNumber(distanceKm);
  const numericWeight = toFiniteNumber(weightValue);
  const numericWaitingMinutes = toFiniteNumber(waitingMinutes);
  const numericExtraDistanceKm = toFiniteNumber(extraDistanceKm);

  if (typeof vehicleType !== "string" || !vehicleType.trim()) {
    const error = new Error("Invalid vehicle type");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(numericDistance) || numericDistance < 0) {
    const error = new Error("Invalid distance value");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(numericWeight) || numericWeight < 0) {
    const error = new Error("Invalid weight value");
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(numericWaitingMinutes) || numericWaitingMinutes < 0) {
    const error = new Error("Invalid waiting time");
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(numericExtraDistanceKm) || numericExtraDistanceKm < 0) {
    const error = new Error("Invalid extra distance");
    error.status = 400;
    throw error;
  }
  if (typeof loadingRequired !== "boolean" || typeof unloadingRequired !== "boolean") {
    const error = new Error("Invalid cargo handling requirements");
    error.status = 400;
    throw error;
  }

  if (weightUnit !== "kg" && weightUnit !== "ton") {
    const error = new Error("Invalid weight unit");
    error.status = 400;
    throw error;
  }

  const fareConfig = await getFareByVehicleType(vehicleType);
  if (!fareConfig) {
    const error = new Error("Active fare not found for this vehicle");
    error.status = 404;
    throw error;
  }

  const ratePerKm = Number(fareConfig.perKmRate || 0);
  const ratePerTon = Number(fareConfig.perTonRate || 0);
  const minimumFare = Number(fareConfig.minimumFare || 0);

  // Cargo Weight in KG & Weight in Ton
  // Weight in Ton = Cargo Weight in KG / 1000
  const cargoWeightKg = Number((weightUnit === "ton" ? numericWeight * 1000 : numericWeight).toFixed(2));
  const weightInTon = Number((cargoWeightKg / 1000).toFixed(4));

  // Distance Charge = Actual ORS Road Distance KM × Rate Per KM
  const distanceCharge = Number((numericDistance * ratePerKm).toFixed(2));

  // Weight Charge = Weight in Ton × Rate Per Ton
  const weightCharge = Number((weightInTon * ratePerTon).toFixed(2));
  const loadingCharge = loadingRequired ? Number(fareConfig.loadingCharge || 0) : 0;
  const unloadingCharge = unloadingRequired ? Number(fareConfig.unloadingCharge || 0) : 0;
  const waitingCharge = Number(
    ((numericWaitingMinutes / 60) * Number(fareConfig.waitingCharge || 0)).toFixed(2)
  );
  const extraDistanceCharge = Number(
    (numericExtraDistanceKm * Number(fareConfig.extraDistanceCharge || 0)).toFixed(2)
  );

  const calculatedFare = Number((
    distanceCharge +
    weightCharge +
    loadingCharge +
    unloadingCharge +
    waitingCharge +
    extraDistanceCharge
  ).toFixed(2));

  // Final Fare = MAX(Calculated Fare, Minimum Fare)
  const finalFare = Number(Math.max(calculatedFare, minimumFare).toFixed(2));

  if (!Number.isFinite(finalFare)) {
    const error = new Error("Fare calculation produced an invalid amount");
    error.status = 400;
    throw error;
  }

  return {
    category: vehicleType,
    fareConfig,
    ratePerKm,
    ratePerTon,
    minimumFare,
    distanceKm: numericDistance,
    cargoWeightKg,
    weightInTon,
    distanceCharge,
    weightCharge,
    loadingCharge,
    unloadingCharge,
    waitingMinutes: numericWaitingMinutes,
    waitingCharge,
    extraDistanceKm: numericExtraDistanceKm,
    extraDistanceCharge,
    calculatedFare,
    finalFare
  };
};

export const calculateEstimatedFare = async (options) => {
  const breakdown = await calculateFareBreakdown(options);
  return breakdown.finalFare;
};

export const calculateMultiVehicleFareQuotes = async ({
  distanceKm,
  weightValue,
  weightUnit,
  vehicleType,
  serviceCategory,
  loadingRequired = false,
  unloadingRequired = false
}) => {
  const filter = { isActive: true };
  if (vehicleType) {
    filter.vehicleType = vehicleType;
  }
  if (serviceCategory) {
    const eligibleTypes = VEHICLE_TYPES_BY_CATEGORY[serviceCategory];
    if (!eligibleTypes) {
      const error = new Error("Invalid service category");
      error.status = 400;
      throw error;
    }
    const settingKey = getCategoryEnabledSettingKey(serviceCategory);
    if (settingKey && !(await isSettingEnabled(settingKey))) {
      const error = new Error("Service category is unavailable");
      error.status = 403;
      throw error;
    }
    if (vehicleType && !eligibleTypes.includes(vehicleType)) {
      const error = new Error("Vehicle type does not belong to the selected service category");
      error.status = 400;
      throw error;
    }
    filter.vehicleType = vehicleType || { $in: eligibleTypes };
  } else if (vehicleType) {
    const category = getServiceCategoryForVehicleType(vehicleType);
    const settingKey = getCategoryEnabledSettingKey(category);
    if (settingKey && !(await isSettingEnabled(settingKey))) {
      const error = new Error("Service category is unavailable");
      error.status = 403;
      throw error;
    }
  } else {
    const enabledTypes = [];
    for (const [category, types] of Object.entries(VEHICLE_TYPES_BY_CATEGORY)) {
      const settingKey = getCategoryEnabledSettingKey(category);
      if (!settingKey || await isSettingEnabled(settingKey)) {
        enabledTypes.push(...types);
      }
    }
    filter.vehicleType = { $in: enabledTypes };
  }

  const activeFares = await getAllFares(filter);
  if (!activeFares.length) {
    const error = new Error("No active fares configured");
    error.status = 404;
    throw error;
  }

  const quotes = [];
  for (const fare of activeFares) {
    const breakdown = await calculateFareBreakdown({
      vehicleType: fare.vehicleType,
      distanceKm,
      weightValue,
      weightUnit,
      loadingRequired,
      unloadingRequired
    });
    quotes.push({
      vehicleType: fare.vehicleType,
      category: getServiceCategoryForVehicleType(fare.vehicleType),
      ratePerKm: breakdown.ratePerKm,
      ratePerTon: breakdown.ratePerTon,
      minimumFare: breakdown.minimumFare,
      loadingCharge: fare.loadingCharge || 0,
      unloadingCharge: fare.unloadingCharge || 0,
      waitingChargePerHour: fare.waitingCharge || 0,
      extraDistanceChargePerKm: fare.extraDistanceCharge || 0,
      distanceKm: breakdown.distanceKm,
      cargoWeightKg: breakdown.cargoWeightKg,
      weightInTon: breakdown.weightInTon,
      distanceCharge: breakdown.distanceCharge,
      weightCharge: breakdown.weightCharge,
      loadingChargeAmount: breakdown.loadingCharge,
      unloadingChargeAmount: breakdown.unloadingCharge,
      calculatedFare: breakdown.calculatedFare,
      finalFare: breakdown.finalFare
    });
  }

  return quotes;
};
