export const CANONICAL_SERVICE_CATEGORIES = Object.freeze({
  EV_PASSENGER: "EV_PASSENGER",
  TAXI: "TAXI",
  GOODS_TRANSPORT: "GOODS_TRANSPORT"
});

export const SERVICE_CATEGORIES = Object.freeze({
  EV_PASSENGER: "EV_PASSENGER",
  TAXI: "TAXI",
  GOODS_TRANSPORT: "GOODS_TRANSPORT",
  // Legacy aliases
  TRUCK: "TRUCK",
  EV_GOODS: "EV_GOODS",
  GOODS_TAXI: "GOODS_TAXI"
});

export const SERVICE_CATEGORY_LABELS = Object.freeze({
  [SERVICE_CATEGORIES.EV_PASSENGER]: "EV Passenger",
  [SERVICE_CATEGORIES.TAXI]: "Taxi",
  [SERVICE_CATEGORIES.GOODS_TRANSPORT]: "Goods Transport",
  [SERVICE_CATEGORIES.TRUCK]: "Goods Transport",
  [SERVICE_CATEGORIES.EV_GOODS]: "EV Passenger",
  [SERVICE_CATEGORIES.GOODS_TAXI]: "Taxi"
});

export const VEHICLE_TYPES_BY_CATEGORY = Object.freeze({
  [SERVICE_CATEGORIES.EV_PASSENGER]: [
    "electric-rickshaw",
    "electric-passenger-three-wheeler",
    "other-electric-passenger"
  ],
  [SERVICE_CATEGORIES.TAXI]: [
    "sedan",
    "hatchback",
    "suv"
  ],
  [SERVICE_CATEGORIES.GOODS_TRANSPORT]: [
    "pickup",
    "mini-truck",
    "small-truck",
    "medium-truck",
    "large-truck"
  ],
  // Legacy aliases mapped
  [SERVICE_CATEGORIES.TRUCK]: [
    "pickup",
    "mini-truck",
    "small-truck",
    "medium-truck",
    "large-truck"
  ],
  [SERVICE_CATEGORIES.EV_GOODS]: [
    "electric-cargo-loader",
    "electric-goods-e-rickshaw",
    "electric-mini-cargo-carrier",
    "other-electric-goods"
  ],
  [SERVICE_CATEGORIES.GOODS_TAXI]: [
    "mini-pickup",
    "tata-ace",
    "cargo-pickup",
    "goods-loading-taxi",
    "other-goods-carrier"
  ]
});

export const canonicalizeServiceCategory = (category, vehicleType) => {
  if (!category) {
    if (vehicleType) return getServiceCategoryForVehicleType(vehicleType);
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }
  const upper = String(category).trim().toUpperCase();
  if (upper === "EV_PASSENGER") return SERVICE_CATEGORIES.EV_PASSENGER;
  if (upper === "TAXI") return SERVICE_CATEGORIES.TAXI;
  if (upper === "GOODS_TRANSPORT" || upper === "TRUCK") return SERVICE_CATEGORIES.GOODS_TRANSPORT;

  if (upper === "EV_GOODS") {
    if (vehicleType) {
      const vt = String(vehicleType).toLowerCase();
      if (VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.EV_PASSENGER]?.includes(vt)) {
        return SERVICE_CATEGORIES.EV_PASSENGER;
      }
      return SERVICE_CATEGORIES.GOODS_TRANSPORT;
    }
    return SERVICE_CATEGORIES.EV_PASSENGER;
  }

  if (upper === "GOODS_TAXI") {
    if (vehicleType) {
      const vt = String(vehicleType).toLowerCase();
      if (VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.TAXI]?.includes(vt)) {
        return SERVICE_CATEGORIES.TAXI;
      }
      return SERVICE_CATEGORIES.GOODS_TRANSPORT;
    }
    return SERVICE_CATEGORIES.TAXI;
  }

  return category;
};

export const isPassengerCategory = (categoryOrVehicle) => {
  if (!categoryOrVehicle) return false;
  let cat = null;
  let vehicleType = null;
  if (typeof categoryOrVehicle === "string") {
    cat = categoryOrVehicle;
  } else {
    cat = categoryOrVehicle.serviceCategory || categoryOrVehicle.category || categoryOrVehicle.vehicle?.serviceCategory;
    vehicleType = categoryOrVehicle.vehicleType || categoryOrVehicle.vehicle?.vehicleType;
  }

  if (vehicleType) {
    const vt = String(vehicleType).toLowerCase();
    if ([
      "electric-cargo-loader", "electric-goods-e-rickshaw", "electric-mini-cargo-carrier", "other-electric-goods",
      "mini-truck", "pickup", "small-truck", "medium-truck", "large-truck",
      "mini-pickup", "cargo-pickup", "goods-loading-taxi", "other-goods-carrier"
    ].includes(vt)) {
      return false;
    }
    if ([
      "electric-rickshaw", "electric-passenger-three-wheeler", "other-electric-passenger",
      "sedan", "hatchback", "suv"
    ].includes(vt)) {
      return true;
    }
  }

  const canonical = canonicalizeServiceCategory(cat, vehicleType);
  return canonical === SERVICE_CATEGORIES.EV_PASSENGER || canonical === SERVICE_CATEGORIES.TAXI;
};

export const isGoodsCategory = (categoryOrVehicle) => !isPassengerCategory(categoryOrVehicle);

export const getServiceCategoryForVehicleType = (vehicleType) => {
  if (!vehicleType) return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  const vt = String(vehicleType).toLowerCase();
  for (const cat of [SERVICE_CATEGORIES.EV_PASSENGER, SERVICE_CATEGORIES.TAXI, SERVICE_CATEGORIES.GOODS_TRANSPORT]) {
    if (VEHICLE_TYPES_BY_CATEGORY[cat]?.includes(vt)) {
      return cat;
    }
  }
  if (["electric-cargo-loader", "electric-goods-e-rickshaw", "electric-mini-cargo-carrier", "other-electric-goods", "mini-pickup", "tata-ace", "cargo-pickup", "goods-loading-taxi", "other-goods-carrier"].includes(vt)) {
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }
  return SERVICE_CATEGORIES.GOODS_TRANSPORT;
};

/**
 * Resolves the service category for a vehicle or booking record.
 * Uses vehicle.serviceCategory as the primary category identifier.
 */
export const resolveVehicleServiceCategory = (vehicleOrBooking) => {
  if (!vehicleOrBooking) return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  const directCategory =
    vehicleOrBooking.serviceCategory ||
    vehicleOrBooking.vehicle?.serviceCategory;
  const type =
    vehicleOrBooking.vehicleType ||
    vehicleOrBooking.vehicle?.vehicleType;
  if (directCategory) {
    return canonicalizeServiceCategory(directCategory, type);
  }
  if (type) {
    return getServiceCategoryForVehicleType(type);
  }
  return SERVICE_CATEGORIES.GOODS_TRANSPORT;
};

/**
 * Returns true if the vehicle or booking belongs to the EV category.
 */
export const isEVVehicle = (vehicleOrBooking) => {
  if (!vehicleOrBooking) return false;
  const rawCat = vehicleOrBooking.serviceCategory || vehicleOrBooking.vehicle?.serviceCategory;
  const rawType = vehicleOrBooking.vehicleType || vehicleOrBooking.vehicle?.vehicleType;
  if (rawCat === SERVICE_CATEGORIES.EV_PASSENGER || rawCat === "EV_PASSENGER" || rawCat === "EV_GOODS") {
    return true;
  }
  if (rawType && (
    VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.EV_PASSENGER]?.includes(rawType) ||
    ["electric-cargo-loader", "electric-goods-e-rickshaw", "electric-mini-cargo-carrier", "other-electric-goods"].includes(rawType)
  )) {
    return true;
  }
  return false;
};

/**
 * Returns the customer-facing category label.
 * Returns "EV Passenger" for EV_PASSENGER, "Taxi" for TAXI, and "Goods Transport" for GOODS_TRANSPORT.
 */
export const getVehicleCategoryLabel = (vehicleOrBooking, options = { plural: false }) => {
  const category = resolveVehicleServiceCategory(vehicleOrBooking);
  if (category === SERVICE_CATEGORIES.EV_PASSENGER || category === SERVICE_CATEGORIES.EV_GOODS) return "EV Passenger";
  if (category === SERVICE_CATEGORIES.TAXI || category === SERVICE_CATEGORIES.GOODS_TAXI) return "Taxi";
  return options?.plural ? "Goods Transport" : "Goods Transport";
};

const CATEGORY_LABELS = {
  // EV Passenger
  "electric-rickshaw": "Electric Rickshaw",
  "electric-passenger-three-wheeler": "Electric Passenger Three-Wheeler",
  "other-electric-passenger": "Electric Passenger Vehicle",
  // Taxi
  "sedan": "Sedan Taxi",
  "hatchback": "Hatchback Taxi",
  "suv": "SUV Taxi",
  // Goods Transport
  "mini-truck": "Mini Truck",
  "pickup": "Pickup Truck",
  "small-truck": "Small Truck",
  "medium-truck": "Medium Truck",
  "large-truck": "Large Heavy Truck",
  // Legacy aliases
  "electric-cargo-loader": "Electric Passenger Vehicle",
  "electric-goods-e-rickshaw": "Electric Rickshaw",
  "electric-mini-cargo-carrier": "Electric Passenger Three-Wheeler",
  "other-electric-goods": "Electric Passenger Vehicle",
  "mini-pickup": "Pickup Truck",
  "tata-ace": "Mini Truck",
  "cargo-pickup": "Pickup Truck",
  "goods-loading-taxi": "Sedan Taxi",
  "other-goods-carrier": "Goods Carrier"
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
  canonicalizeServiceCategory,
  isPassengerCategory,
  isGoodsCategory,
  isEVVehicle,
  getVehicleCategoryLabel
};

