import { getSetting } from "./systemSettingService.js";
import { SERVICE_CATEGORIES } from "../utils/vehicleCategories.js";

const getCategorySettingPrefix = (serviceCategory) => {
  if (serviceCategory === SERVICE_CATEGORIES.EV_GOODS) return "service.ev_goods";
  if (serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI) return "service.goods_taxi";
  return null;
};

const toCapacityKg = (loadCapacity) =>
  Number(loadCapacity?.value || 0) *
  (loadCapacity?.unit === "ton" ? 1000 : 1);

export const validateGoodsVehiclePolicy = async ({
  serviceCategory,
  vehicleType,
  loadCapacity,
  serviceAreas = []
}) => {
  const prefix = getCategorySettingPrefix(serviceCategory);
  if (!prefix) return;

  const [allowedTypes, maxCapacityKg, supportedAreas] = await Promise.all([
    getSetting(`${prefix}.allowed_vehicle_types`),
    getSetting(`${prefix}.max_capacity_kg`),
    getSetting(`${prefix}.service_areas`)
  ]);
  if (!Array.isArray(allowedTypes) || !allowedTypes.includes(vehicleType)) {
    const error = new Error("This goods vehicle type is not enabled by the administrator");
    error.status = 400;
    throw error;
  }

  const requestedCapacityKg = toCapacityKg(loadCapacity);
  if (
    Number.isFinite(Number(maxCapacityKg)) &&
    Number(maxCapacityKg) > 0 &&
    requestedCapacityKg > Number(maxCapacityKg)
  ) {
    const error = new Error("Vehicle capacity exceeds the administrator's category limit");
    error.status = 400;
    throw error;
  }

  if (
    Array.isArray(supportedAreas) &&
    supportedAreas.length > 0 &&
    serviceAreas.some((area) => !supportedAreas.includes(area))
  ) {
    const error = new Error("Vehicle service area is not enabled by the administrator");
    error.status = 400;
    throw error;
  }
};

export const vehicleServesRoute = (vehicle, pickupAddress, dropAddress) => {
  const areas = vehicle?.serviceAreas || [];
  if (!areas.length) return false;
  const normalize = (address) => String(address || "").trim().toLowerCase();
  const pickup = normalize(pickupAddress);
  const drop = normalize(dropAddress);
  if (!pickup || !drop) return false;
  const areaMatches = (address) =>
    areas.some((area) => {
      const normalizedArea = normalize(area);
      return normalizedArea && address.includes(normalizedArea);
    });
  return areaMatches(pickup) && areaMatches(drop);
};
