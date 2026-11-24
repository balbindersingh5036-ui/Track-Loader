import { getSetting, isSettingEnabled } from "./systemSettingService.js";
import {
  SERVICE_CATEGORIES,
  canonicalizeServiceCategory,
  isPassengerCategory
} from "../utils/vehicleCategories.js";

const getCategorySettingPrefix = (serviceCategory) => {
  if (serviceCategory === SERVICE_CATEGORIES.EV_GOODS) return "service.ev_goods";
  if (serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI) return "service.goods_taxi";
  if (serviceCategory === SERVICE_CATEGORIES.EV_PASSENGER) return "service.ev_passenger";
  if (serviceCategory === SERVICE_CATEGORIES.TAXI) return "service.taxi";
  return null;
};

export const DEFAULT_ALLOWED_VEHICLE_TYPES = Object.freeze({
  [SERVICE_CATEGORIES.EV_GOODS]: [
    "electric-cargo-loader",
    "electric-goods-e-rickshaw",
    "electric-mini-cargo-carrier"
  ],
  [SERVICE_CATEGORIES.GOODS_TAXI]: [
    "mini-pickup",
    "tata-ace",
    "cargo-pickup",
    "goods-loading-taxi"
  ],
  [SERVICE_CATEGORIES.EV_PASSENGER]: [
    "electric-rickshaw",
    "electric-passenger-three-wheeler",
    "other-electric-passenger"
  ],
  [SERVICE_CATEGORIES.TAXI]: [
    "sedan",
    "hatchback",
    "suv"
  ]
});

const toCapacityKg = (loadCapacity) =>
  Number(loadCapacity?.value || 0) *
  (loadCapacity?.unit === "ton" ? 1000 : 1);

export const validateVehiclePolicy = async ({
  serviceCategory,
  vehicleType,
  loadCapacity,
  serviceAreas = []
}) => {
  const prefix = getCategorySettingPrefix(serviceCategory);
  if (!prefix) return;

  const isEnabled = await isSettingEnabled(`${prefix}.enabled`);
  if (!isEnabled) {
    const error = new Error("This goods vehicle category is not enabled by the administrator");
    error.status = 400;
    throw error;
  }

  const [configuredAllowedTypes, maxCapacityKg, supportedAreas] = await Promise.all([
    getSetting(`${prefix}.allowed_vehicle_types`),
    getSetting(`${prefix}.max_capacity_kg`),
    getSetting(`${prefix}.service_areas`)
  ]);

  const allowedTypes = Array.isArray(configuredAllowedTypes)
    ? configuredAllowedTypes
    : DEFAULT_ALLOWED_VEHICLE_TYPES[serviceCategory] || [];

  if (!allowedTypes.includes(vehicleType)) {
    const error = new Error("This goods vehicle type is not enabled by the administrator");
    error.status = 400;
    throw error;
  }

  // Only apply cargo weight limits if not a passenger category or if explicitly limited
  if (!isPassengerCategory(serviceCategory)) {
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

export const validateGoodsVehiclePolicy = validateVehiclePolicy;

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
