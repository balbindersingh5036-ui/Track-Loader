import SystemSetting from "../models/SystemSetting.js";

const cache = new Map();

export const setCachedSetting = (key, value) => {
  cache.set(key, value);
};

const SETTING_FALLBACKS = {
  "service.ev_passenger.enabled": "service.ev_goods.enabled",
  "service.taxi.enabled": "service.goods_taxi.enabled",
  "service.ev_passenger.allowed_vehicle_types": "service.ev_goods.allowed_vehicle_types",
  "service.taxi.allowed_vehicle_types": "service.goods_taxi.allowed_vehicle_types",
  "service.ev_passenger.service_areas": "service.ev_goods.service_areas",
  "service.taxi.service_areas": "service.goods_taxi.service_areas"
};

export const getSetting = async (key) => {
  if (cache.has(key)) return cache.get(key);
  const setting = await SystemSetting.findOne({ key, isActive: true });
  if (setting) {
    cache.set(key, setting.value);
    return setting.value;
  }
  // Check backward-compatibility fallback if setting not found directly
  const fallbackKey = SETTING_FALLBACKS[key];
  if (fallbackKey) {
    const fallbackSetting = await SystemSetting.findOne({ key: fallbackKey, isActive: true });
    if (fallbackSetting) {
      cache.set(key, fallbackSetting.value);
      return fallbackSetting.value;
    }
  }
  return null;
};

export const getSettings = async (category) => {
  return SystemSetting.find({ category });
};

export const getAllSettings = async () => {
  return SystemSetting.find({});
};

export const setSetting = async (key, value, type, category, description, updatedBy) => {
  const setting = await SystemSetting.findOneAndUpdate(
    { key },
    { value, type, category, description, updatedBy },
    { new: true, upsert: true }
  );
  cache.delete(key);
  // Also invalidate fallback alias if any
  for (const [k, fb] of Object.entries(SETTING_FALLBACKS)) {
    if (k === key || fb === key) {
      cache.delete(k);
      cache.delete(fb);
    }
  }
  return setting;
};

export const isSettingEnabled = async (key) => {
  const val = await getSetting(key);
  if (val !== null && val !== undefined) return val === true;
  // If primary not set, check fallback
  const fallbackKey = SETTING_FALLBACKS[key];
  if (fallbackKey) {
    const fallbackVal = await getSetting(fallbackKey);
    return fallbackVal === true;
  }
  return false;
};

export const clearCache = (key) => {
  if (key) cache.delete(key);
  else cache.clear();
};
