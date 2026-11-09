import mongoose from "mongoose";
import Fare from "../models/Fare.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import { isSettingEnabled } from "./systemSettingService.js";

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
  try {
    distinctTypes = await Vehicle.distinct("vehicleType");
  } catch (err) {
    // Fallback gracefully if database is unavailable
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

  const cacheKey = `fare_${targetType}`;
  if (fareCache.has(cacheKey)) return fareCache.get(cacheKey);

  const fare = await Fare.findOne({ vehicleType: targetType, isActive: true })
    .populate("updatedBy", "name email")
    .lean();
  if (fare) {
    fareCache.set(cacheKey, fare);
  }
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
    data.minimumFare !== undefined
  ) {
    const historyEntry = {
      perKmRate: data.perKmRate !== undefined ? Number(data.perKmRate) : current.perKmRate,
      perTonRate: data.perTonRate !== undefined ? Number(data.perTonRate) : current.perTonRate,
      minimumFare: data.minimumFare !== undefined ? Number(data.minimumFare) : current.minimumFare,
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

export const calculateFareBreakdown = async ({ vehicleType, distanceKm, weightValue, weightUnit }) => {
  const numericDistance = toFiniteNumber(distanceKm);
  const numericWeight = toFiniteNumber(weightValue);

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

  // Calculated Fare = Distance Charge + Weight Charge
  const calculatedFare = Number((distanceCharge + weightCharge).toFixed(2));

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
    calculatedFare,
    finalFare
  };
};

export const calculateEstimatedFare = async ({ vehicleType, distanceKm, weightValue, weightUnit }) => {
  const breakdown = await calculateFareBreakdown({ vehicleType, distanceKm, weightValue, weightUnit });
  return breakdown.finalFare;
};
