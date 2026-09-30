import SystemSetting from "../models/SystemSetting.js";

const cache = new Map();

export const getSetting = async (key) => {
  if (cache.has(key)) return cache.get(key);
  const setting = await SystemSetting.findOne({ key, isActive: true });
  if (setting) {
    cache.set(key, setting.value);
    return setting.value;
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
  return setting;
};

export const isSettingEnabled = async (key) => {
  const val = await getSetting(key);
  return val === true;
};

export const clearCache = (key) => {
  if (key) cache.delete(key);
  else cache.clear();
};
