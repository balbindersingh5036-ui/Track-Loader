const CATEGORY_LABELS = {
  "mini-truck": "Mini Truck",
  "pickup": "Pickup Truck",
  "small-truck": "Small Truck",
  "medium-truck": "Medium Truck",
  "large-truck": "Large Heavy Truck"
};

export const formatVehicleCategory = (category) => {
  if (!category) return "Commercial Vehicle";
  return (
    CATEGORY_LABELS[category] ||
    category
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

export const isValidVehicleModel = (model) => {
  if (!model || typeof model !== "string") return false;
  const clean = model.trim();
  if (clean.length < 2) return false;
  if (/^[0-9\s.,-]+$/.test(clean)) return false; // purely numbers or separators (e.g. "300")
  if (/^[0-9a-fA-F]{24}$/.test(clean)) return false; // MongoDB ObjectId
  if (!/[a-zA-Z]/.test(clean)) return false; // must contain letters
  return true;
};

export const formatFullVehicleModel = (make, model) => {
  const cleanMake = typeof make === "string" ? make.trim() : "";
  const cleanModel = typeof model === "string" ? model.trim() : "";

  if (cleanMake && cleanModel) {
    if (cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())) {
      return cleanModel;
    }
    return `${cleanMake} ${cleanModel}`;
  }
  return cleanModel || cleanMake;
};

/**
 * Returns a clean vehicle display name from a vehicle or booking record.
 * Never outputs arbitrary numeric strings like "300" or raw IDs.
 */
export const getCleanVehicleDisplayName = (vehicleOrBooking, fallbackCategory = "") => {
  if (!vehicleOrBooking) {
    return fallbackCategory ? formatVehicleCategory(fallbackCategory) : "Commercial Vehicle";
  }

  // 1. Check explicit display names
  const candidateNames = [
    vehicleOrBooking.displayName,
    vehicleOrBooking.vehicleName,
    vehicleOrBooking.vehicle?.displayName,
    vehicleOrBooking.vehicle?.vehicleName
  ];

  for (const name of candidateNames) {
    if (isValidVehicleModel(name)) {
      return name.trim();
    }
  }

  // 2. Check make + model combinations
  const vehicleObj = vehicleOrBooking.vehicle || vehicleOrBooking;
  const make = vehicleObj.vehicleMake || vehicleObj.make || "";
  const rawModel = vehicleObj.vehicleModel || vehicleObj.model || "";

  if (isValidVehicleModel(rawModel)) {
    return formatFullVehicleModel(make, rawModel);
  }

  // If make is valid by itself
  if (isValidVehicleModel(make)) {
    return make.trim();
  }

  // Check booking-level vehicleModel if present
  if (isValidVehicleModel(vehicleOrBooking.vehicleModel)) {
    return vehicleOrBooking.vehicleModel.trim();
  }

  // 3. Fallback to clean vehicle category
  const category =
    vehicleOrBooking.vehicleType ||
    vehicleObj.vehicleType ||
    fallbackCategory;

  return formatVehicleCategory(category);
};

export default {
  CATEGORY_LABELS,
  formatVehicleCategory,
  isValidVehicleModel,
  formatFullVehicleModel,
  getCleanVehicleDisplayName
};

