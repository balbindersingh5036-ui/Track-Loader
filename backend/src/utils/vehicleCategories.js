export const CANONICAL_SERVICE_CATEGORIES = Object.freeze({
  EV_PASSENGER: "EV_PASSENGER",
  TAXI: "TAXI",
  GOODS_TRANSPORT: "GOODS_TRANSPORT"
});

export const SERVICE_CATEGORIES = Object.freeze({
  TRUCK: "TRUCK",
  EV_GOODS: "EV_GOODS",
  GOODS_TAXI: "GOODS_TAXI",
  EV_PASSENGER: "EV_PASSENGER",
  TAXI: "TAXI",
  GOODS_TRANSPORT: "GOODS_TRANSPORT"
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
  [SERVICE_CATEGORIES.TRUCK]: [
    "mini-truck",
    "pickup",
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
  ],
  [SERVICE_CATEGORIES.GOODS_TRANSPORT]: [
    "pickup",
    "mini-truck",
    "small-truck",
    "medium-truck",
    "large-truck"
  ]
});

export const VEHICLE_TYPES = Object.freeze(
  [...new Set(Object.values(VEHICLE_TYPES_BY_CATEGORY).flat())]
);

export const canonicalizeServiceCategory = (category, vehicleType) => {
  if (!category) {
    if (vehicleType) {
      const cat = getServiceCategoryForVehicleType(vehicleType);
      return canonicalizeServiceCategory(cat, vehicleType);
    }
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }
  const upper = String(category).trim().toUpperCase();
  if (upper === "EV_PASSENGER") return SERVICE_CATEGORIES.EV_PASSENGER;
  if (upper === "TAXI") return SERVICE_CATEGORIES.TAXI;
  if (upper === "GOODS_TRANSPORT" || upper === "TRUCK") return SERVICE_CATEGORIES.GOODS_TRANSPORT;

  // Legacy aliases
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

  // If a specific cargo vehicleType is provided, it is never a passenger category
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

export const isGoodsCategory = (categoryOrVehicle) => {
  return !isPassengerCategory(categoryOrVehicle);
};

export const getServiceCategoryForVehicleType = (vehicleType) => {
  if (!vehicleType) return null;
  // Match exact category first, preserving legacy test expectations
  for (const [cat, types] of Object.entries(VEHICLE_TYPES_BY_CATEGORY)) {
    if (types.includes(vehicleType)) {
      return cat;
    }
  }
  return null;
};

export const isValidCategoryVehicleType = (serviceCategory, vehicleType) => {
  if (!serviceCategory || !vehicleType) return false;
  return VEHICLE_TYPES_BY_CATEGORY[serviceCategory]?.includes(vehicleType) || false;
};

export const getCategoryEnabledSettingKey = (serviceCategory) => {
  if (!serviceCategory) return null;
  const upper = String(serviceCategory).trim().toUpperCase();
  if (upper === SERVICE_CATEGORIES.EV_PASSENGER) {
    return "service.ev_passenger.enabled";
  }
  if (upper === SERVICE_CATEGORIES.TAXI) {
    return "service.taxi.enabled";
  }
  if (upper === SERVICE_CATEGORIES.EV_GOODS) {
    return "service.ev_goods.enabled";
  }
  if (upper === SERVICE_CATEGORIES.GOODS_TAXI) {
    return "service.goods_taxi.enabled";
  }
  return null;
};
