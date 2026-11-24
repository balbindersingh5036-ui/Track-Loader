export const SERVICE_CATEGORIES = Object.freeze({
  EV_PASSENGER: 'EV_PASSENGER',
  TAXI: 'TAXI',
  GOODS_TRANSPORT: 'GOODS_TRANSPORT',
  // Legacy aliases for backward compatibility
  TRUCK: 'TRUCK',
  EV_GOODS: 'EV_GOODS',
  GOODS_TAXI: 'GOODS_TAXI'
});

export const SERVICE_CATEGORY_LABELS = Object.freeze({
  [SERVICE_CATEGORIES.EV_PASSENGER]: 'EV Passenger',
  [SERVICE_CATEGORIES.TAXI]: 'Taxi',
  [SERVICE_CATEGORIES.GOODS_TRANSPORT]: 'Goods Transport',
  [SERVICE_CATEGORIES.TRUCK]: 'Goods Transport',
  [SERVICE_CATEGORIES.EV_GOODS]: 'EV Passenger',
  [SERVICE_CATEGORIES.GOODS_TAXI]: 'Taxi'
});

export const VEHICLE_TYPES_BY_CATEGORY = Object.freeze({
  [SERVICE_CATEGORIES.EV_PASSENGER]: [
    'electric-rickshaw',
    'electric-passenger-three-wheeler',
    'other-electric-passenger'
  ],
  [SERVICE_CATEGORIES.TAXI]: [
    'sedan',
    'hatchback',
    'suv'
  ],
  [SERVICE_CATEGORIES.GOODS_TRANSPORT]: [
    'pickup',
    'mini-truck',
    'small-truck',
    'medium-truck',
    'large-truck'
  ],
  // Legacy categories mapped for backward compatibility
  [SERVICE_CATEGORIES.TRUCK]: [
    'mini-truck',
    'pickup',
    'small-truck',
    'medium-truck',
    'large-truck'
  ],
  [SERVICE_CATEGORIES.EV_GOODS]: [
    'electric-rickshaw',
    'electric-passenger-three-wheeler',
    'other-electric-passenger',
    'electric-cargo-loader',
    'electric-goods-e-rickshaw',
    'electric-mini-cargo-carrier',
    'other-electric-goods'
  ],
  [SERVICE_CATEGORIES.GOODS_TAXI]: [
    'sedan',
    'hatchback',
    'suv',
    'mini-pickup',
    'tata-ace',
    'cargo-pickup',
    'goods-loading-taxi',
    'other-goods-carrier'
  ]
});

export const VEHICLE_TYPES = Object.freeze(
  [...new Set(Object.values(VEHICLE_TYPES_BY_CATEGORY).flat())]
);

export const canonicalizeServiceCategory = (category, vehicleType) => {
  if (!category) {
    if (vehicleType) return getServiceCategoryForVehicleType(vehicleType);
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }
  const upper = String(category).trim().toUpperCase();
  if (upper === 'EV_PASSENGER') return SERVICE_CATEGORIES.EV_PASSENGER;
  if (upper === 'TAXI') return SERVICE_CATEGORIES.TAXI;
  if (upper === 'GOODS_TRANSPORT' || upper === 'TRUCK') return SERVICE_CATEGORIES.GOODS_TRANSPORT;

  if (upper === 'EV_GOODS') {
    if (vehicleType) {
      const vt = String(vehicleType).toLowerCase();
      if (VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.EV_PASSENGER]?.includes(vt)) {
        return SERVICE_CATEGORIES.EV_PASSENGER;
      }
      return SERVICE_CATEGORIES.GOODS_TRANSPORT;
    }
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }

  if (upper === 'GOODS_TAXI') {
    if (vehicleType) {
      const vt = String(vehicleType).toLowerCase();
      if (VEHICLE_TYPES_BY_CATEGORY[SERVICE_CATEGORIES.TAXI]?.includes(vt)) {
        return SERVICE_CATEGORIES.TAXI;
      }
      return SERVICE_CATEGORIES.GOODS_TRANSPORT;
    }
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }

  return category;
};

export const isPassengerCategory = (categoryOrVehicle) => {
  if (!categoryOrVehicle) return false;
  let cat = null;
  let vehicleType = null;
  if (typeof categoryOrVehicle === 'string') {
    cat = categoryOrVehicle;
  } else {
    cat = categoryOrVehicle.serviceCategory || categoryOrVehicle.category || categoryOrVehicle.vehicle?.serviceCategory;
    vehicleType = categoryOrVehicle.vehicleType || categoryOrVehicle.vehicle?.vehicleType;
  }

  if (vehicleType) {
    const vt = String(vehicleType).toLowerCase();
    if ([
      'electric-cargo-loader', 'electric-goods-e-rickshaw', 'electric-mini-cargo-carrier', 'other-electric-goods',
      'mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck',
      'mini-pickup', 'cargo-pickup', 'goods-loading-taxi', 'other-goods-carrier'
    ].includes(vt)) {
      return false;
    }
    if ([
      'electric-rickshaw', 'electric-passenger-three-wheeler', 'other-electric-passenger',
      'sedan', 'hatchback', 'suv'
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
  if (!vehicleType) return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  const vt = String(vehicleType).toLowerCase();
  for (const cat of [SERVICE_CATEGORIES.EV_PASSENGER, SERVICE_CATEGORIES.TAXI, SERVICE_CATEGORIES.GOODS_TRANSPORT]) {
    if (VEHICLE_TYPES_BY_CATEGORY[cat]?.includes(vt)) {
      return cat;
    }
  }
  if (['electric-cargo-loader', 'electric-goods-e-rickshaw', 'electric-mini-cargo-carrier', 'other-electric-goods', 'mini-pickup', 'tata-ace', 'cargo-pickup', 'goods-loading-taxi', 'other-goods-carrier'].includes(vt)) {
    return SERVICE_CATEGORIES.GOODS_TRANSPORT;
  }
  return SERVICE_CATEGORIES.GOODS_TRANSPORT;
};

export const resolveVehicleCategory = (vehicle) => {
  if (vehicle?.serviceCategory && Object.values(SERVICE_CATEGORIES).includes(vehicle.serviceCategory)) {
    return vehicle.serviceCategory;
  }
  if (vehicle?.vehicleType) {
    return getServiceCategoryForVehicleType(vehicle.vehicleType);
  }
  return SERVICE_CATEGORIES.GOODS_TRANSPORT;
};

const VEHICLE_TYPE_NAMES = {
  'electric-rickshaw': 'Electric Rickshaw',
  'electric-passenger-three-wheeler': 'Electric Passenger 3-Wheeler',
  'other-electric-passenger': 'Other Electric Passenger',
  'sedan': 'Sedan',
  'hatchback': 'Hatchback',
  'suv': 'SUV',
  'pickup': 'Pickup',
  'mini-truck': 'Mini Truck',
  'small-truck': 'Small Truck',
  'medium-truck': 'Medium Truck',
  'large-truck': 'Large Truck',
  // Legacy
  'electric-cargo-loader': 'Electric Rickshaw',
  'electric-goods-e-rickshaw': 'Electric Passenger 3-Wheeler',
  'electric-mini-cargo-carrier': 'Electric Passenger Carrier',
  'other-electric-goods': 'Other Electric Passenger',
  'mini-pickup': 'Hatchback',
  'tata-ace': 'Sedan',
  'cargo-pickup': 'SUV',
  'goods-loading-taxi': 'Taxi',
  'other-goods-carrier': 'Taxi'
};

export const formatVehicleType = (vehicleType) => {
  if (!vehicleType) return '—';
  if (VEHICLE_TYPE_NAMES[vehicleType]) return VEHICLE_TYPE_NAMES[vehicleType];
  return vehicleType
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
