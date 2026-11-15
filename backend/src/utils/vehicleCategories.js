export const SERVICE_CATEGORIES = Object.freeze({
  TRUCK: "TRUCK",
  EV_GOODS: "EV_GOODS",
  GOODS_TAXI: "GOODS_TAXI"
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
  ]
});

export const VEHICLE_TYPES = Object.freeze(
  Object.values(VEHICLE_TYPES_BY_CATEGORY).flat()
);

export const getServiceCategoryForVehicleType = (vehicleType) =>
  Object.entries(VEHICLE_TYPES_BY_CATEGORY).find(([, vehicleTypes]) =>
    vehicleTypes.includes(vehicleType)
  )?.[0] || null;

export const isValidCategoryVehicleType = (serviceCategory, vehicleType) =>
  VEHICLE_TYPES_BY_CATEGORY[serviceCategory]?.includes(vehicleType) || false;

export const getCategoryEnabledSettingKey = (serviceCategory) => {
  if (serviceCategory === SERVICE_CATEGORIES.EV_GOODS) {
    return "service.ev_goods.enabled";
  }
  if (serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI) {
    return "service.goods_taxi.enabled";
  }
  return null;
};
