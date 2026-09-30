import mongoose from "mongoose";
import Fare from "../models/Fare.js";
import Booking from "../models/Booking.js";
import { isSettingEnabled } from "./systemSettingService.js";

const fareCache = new Map();

export const isFareEnabled = async () => {
  return await isSettingEnabled("fare.enabled");
};

export const clearFareCache = () => {
  fareCache.clear();
};

export const getAllFares = async (filter = {}) => {
  return Fare.find(filter).lean();
};

export const getFareByVehicleType = async (vehicleType) => {
  const cacheKey = `fare_${vehicleType}`;
  if (fareCache.has(cacheKey)) return fareCache.get(cacheKey);

  const fare = await Fare.findOne({ vehicleType, isActive: true }).lean();
  if (fare) {
    fareCache.set(cacheKey, fare);
  }
  return fare;
};

export const getFareById = async (id) => {
  return Fare.findById(id).lean();
};

export const createFare = async (data) => {
  const fare = new Fare(data);
  await fare.save();
  clearFareCache();
  return fare;
};

export const updateFare = async (id, data) => {
  const fare = await Fare.findByIdAndUpdate(id, data, { new: true, runValidators: true });
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

export const calculateEstimatedFare = async ({ vehicleType, distanceKm, weightValue, weightUnit }) => {
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
    const error = new Error("Fare configuration not found for this vehicle type");
    error.status = 404;
    throw error;
  }

  let estimatedFare = fareConfig.baseFare + (numericDistance * fareConfig.perKmRate);
  
  const weightInTon = weightUnit === "ton" ? numericWeight : numericWeight / 1000;
  estimatedFare += (weightInTon * fareConfig.perTonRate);
  
  estimatedFare += fareConfig.loadingCharge + fareConfig.unloadingCharge;

  if (!Number.isFinite(estimatedFare)) {
    const error = new Error("Fare calculation produced an invalid amount");
    error.status = 400;
    throw error;
  }
  
  if (estimatedFare < fareConfig.minimumFare) {
    estimatedFare = fareConfig.minimumFare;
  }

  return Number(estimatedFare.toFixed(2));
};
