export const SERVICE_CATEGORIES = Object.freeze({
  TRUCK: 'TRUCK',
  EV_GOODS: 'EV_GOODS',
  GOODS_TAXI: 'GOODS_TAXI'
});

export const SERVICE_CATEGORY_LABELS = Object.freeze({
  [SERVICE_CATEGORIES.TRUCK]: 'Truck',
  [SERVICE_CATEGORIES.EV_GOODS]: 'EV Goods',
  [SERVICE_CATEGORIES.GOODS_TAXI]: 'Goods Taxi'
});

export const VEHICLE_TYPES_BY_CATEGORY = Object.freeze({
  [SERVICE_CATEGORIES.TRUCK]: [
    'mini-truck',
    'pickup',
    'small-truck',
    'medium-truck',
    'large-truck'
  ],
  [SERVICE_CATEGORIES.EV_GOODS]: [
    'electric-cargo-loader',
    'electric-goods-e-rickshaw',
    'electric-mini-cargo-carrier',
    'other-electric-goods'
  ],
  [SERVICE_CATEGORIES.GOODS_TAXI]: [
    'mini-pickup',
    'tata-ace',
    'cargo-pickup',
    'goods-loading-taxi',
    'other-goods-carrier'
  ]
});

export const VEHICLE_TYPES = Object.freeze(
  Object.values(VEHICLE_TYPES_BY_CATEGORY).flat()
);

export const getServiceCategoryForVehicleType = (vehicleType) =>
  Object.entries(VEHICLE_TYPES_BY_CATEGORY).find(([, types]) =>
    types.includes(vehicleType)
  )?.[0] || SERVICE_CATEGORIES.TRUCK;

export const resolveVehicleCategory = (vehicle) => {
  if (vehicle?.serviceCategory && Object.values(SERVICE_CATEGORIES).includes(vehicle.serviceCategory)) {
    return vehicle.serviceCategory;
  }
  if (vehicle?.vehicleType) {
    return getServiceCategoryForVehicleType(vehicle.vehicleType);
  }
  return SERVICE_CATEGORIES.TRUCK;
};

export const formatVehicleType = (vehicleType) => {
  if (!vehicleType) return '—';
  return vehicleType
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
