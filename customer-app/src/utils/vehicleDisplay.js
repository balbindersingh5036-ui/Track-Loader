export const SERVICE_CATEGORIES = Object.freeze({
  TRUCK: "TRUCK",
  EV_GOODS: "EV_GOODS",
  GOODS_TAXI: "GOODS_TAXI"
});

export const SERVICE_CATEGORY_LABELS = Object.freeze({
  TRUCK: "Trucks",
  EV_GOODS: "EV Goods",
  GOODS_TAXI: "Goods Taxi"
});

export const VEHICLE_TYPES_BY_CATEGORY = Object.freeze({
  TRUCK: [
    "mini-truck",
    "pickup",
    "small-truck",
    "medium-truck",
    "large-truck"
  ],
  EV_GOODS: [
    "electric-cargo-loader",
    "electric-goods-e-rickshaw",
    "electric-mini-cargo-carrier",
    "other-electric-goods"
  ],
  GOODS_TAXI: [
    "mini-pickup",
    "tata-ace",
    "cargo-pickup",
    "goods-loading-taxi",
    "other-goods-carrier"
  ]
});

export const getServiceCategoryForVehicleType = (vehicleType) =>
  Object.entries(VEHICLE_TYPES_BY_CATEGORY).find(([, types]) =>
    types.includes(vehicleType)
  )?.[0] || "TRUCK";

/**
 * Resolves the service category for a vehicle or booking record.
 * Uses vehicle.serviceCategory as the primary category identifier.
 * Does NOT classify based on vehicle names.
 */
export const resolveVehicleServiceCategory = (vehicleOrBooking) => {
  if (!vehicleOrBooking) return SERVICE_CATEGORIES.TRUCK;
  const directCategory =
    vehicleOrBooking.serviceCategory ||
    vehicleOrBooking.vehicle?.serviceCategory;
  if (directCategory && SERVICE_CATEGORIES[directCategory]) {
    return directCategory;
  }
  const type =
    vehicleOrBooking.vehicleType ||
    vehicleOrBooking.vehicle?.vehicleType;
  if (type) {
    return getServiceCategoryForVehicleType(type);
  }
  return SERVICE_CATEGORIES.TRUCK;
};

/**
 * Returns true if the vehicle or booking belongs to the EV_GOODS category.
 * Only returns true if serviceCategory === 'EV_GOODS' (or fallback vehicleType is an EV type).
 * Strictly does NOT identify vehicles as EV by name alone.
 */
export const isEVVehicle = (vehicleOrBooking) => {
  return resolveVehicleServiceCategory(vehicleOrBooking) === SERVICE_CATEGORIES.EV_GOODS;
};

/**
 * Returns the customer-facing category label.
 * Returns "EV Goods" for EV_GOODS, "Goods Taxi" for GOODS_TAXI, and "Truck" (or "Trucks") for TRUCK.
 * Never outputs "Truck" or "Large Truck" for EV_GOODS.
 */
export const getVehicleCategoryLabel = (vehicleOrBooking, options = { plural: false }) => {
  const category = resolveVehicleServiceCategory(vehicleOrBooking);
  if (category === SERVICE_CATEGORIES.EV_GOODS) return "EV Goods";
  if (category === SERVICE_CATEGORIES.GOODS_TAXI) return "Goods Taxi";
  return options?.plural ? "Trucks" : "Truck";
};

const CATEGORY_LABELS = {
  // Standard Trucks
  "mini-truck": "Mini Truck",
  "pickup": "Pickup Truck",
  "small-truck": "Small Truck",
  "medium-truck": "Medium Truck",
  "large-truck": "Large Heavy Truck",
  // EV Goods
  "electric-cargo-loader": "Electric Cargo Loader",
  "electric-goods-e-rickshaw": "Electric Goods E-Rickshaw",
  "electric-mini-cargo-carrier": "Electric Mini Cargo Carrier",
  "other-electric-goods": "Electric Goods Carrier",
  // Goods Taxi
  "mini-pickup": "Mini Goods Pickup",
  "tata-ace": "Tata Ace / Chota Hathi",
  "cargo-pickup": "Cargo Pickup Taxi",
  "goods-loading-taxi": "Goods Loading Taxi",
  "other-goods-carrier": "Goods Carrier Taxi"
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
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  VEHICLE_TYPES_BY_CATEGORY,
  CATEGORY_LABELS,
  formatVehicleCategory,
  isValidVehicleModel,
  formatFullVehicleModel,
  getCleanVehicleDisplayName,
  getServiceCategoryForVehicleType,
  resolveVehicleServiceCategory,
  isEVVehicle,
  getVehicleCategoryLabel
};

