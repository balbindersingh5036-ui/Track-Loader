import SystemSetting from "../models/SystemSetting.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { setSetting } from "../services/systemSettingService.js";

const PROTECTED_KEYS = [
  "system.maintenanceMode",
  "booking.enabled",
  "service.ev_passenger.enabled",
  "service.taxi.enabled",
  "service.ev_goods.enabled",
  "service.goods_taxi.enabled",
  "payment.enabled",
  "driver.enabled"
];

export const getAdminSettings = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const query = {};
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const settings = await SystemSetting.find(query).sort({ category: 1, key: 1 });
    return successResponse(res, { settings }, "Settings fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch settings", 500);
  }
};

export const getSingleSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await SystemSetting.findOne({ key });
    if (!setting) return errorResponse(res, "Setting not found", 404);
    return successResponse(res, { setting }, "Setting fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch setting", 500);
  }
};

export const createOrUpdateSetting = async (req, res) => {
  try {
    const { key } = req.params || {};
    const payloadKey = req.body.key || key;
    
    if (!payloadKey) return errorResponse(res, "Key is required", 400);
    if (!/^[a-z0-9._-]+$/.test(payloadKey)) return errorResponse(res, "Invalid key format", 400);

    const { value, type, category, description } = req.body;

    if (!["string", "number", "boolean", "json"].includes(type)) {
      return errorResponse(res, "Invalid type", 400);
    }

    if (!["general", "booking", "fare", "payment", "notification", "driver", "customer", "system"].includes(category)) {
      return errorResponse(res, "Invalid category", 400);
    }

    // Validate value matches type
    if (type === "boolean" && typeof value !== "boolean") return errorResponse(res, "Value must be boolean", 400);
    if (type === "number" && typeof value !== "number") return errorResponse(res, "Value must be a number", 400);
    if (type === "string" && typeof value !== "string") return errorResponse(res, "Value must be a string", 400);
    if (type === "json") {
      try {
        if (typeof value === "string") JSON.parse(value);
        else JSON.stringify(value);
      } catch (e) {
        return errorResponse(res, "Value must be valid JSON", 400);
      }
    }

    if (req.method === "POST") {
      const exists = await SystemSetting.findOne({ key: payloadKey });
      if (exists) return errorResponse(res, "Setting key already exists", 409);
    } else if (req.method === "PUT" && key !== payloadKey) {
      return errorResponse(res, "Cannot change key name on update", 400);
    }

    const updatedSetting = await setSetting(payloadKey, value, type, category, description, req.user._id);
    return successResponse(res, { setting: updatedSetting }, "Setting updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to save setting", 500);
  }
};

export const updateSettingStatus = async (req, res) => {
  try {
    const { key } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== "boolean") return errorResponse(res, "isActive must be a boolean", 400);

    const setting = await SystemSetting.findOneAndUpdate(
      { key },
      { isActive, updatedBy: req.user._id },
      { new: true }
    );
    if (!setting) return errorResponse(res, "Setting not found", 404);

    return successResponse(res, { setting }, "Setting status updated");
  } catch (error) {
    return errorResponse(res, "Failed to update setting status", 500);
  }
};

export const deleteSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (PROTECTED_KEYS.includes(key)) {
      return errorResponse(res, "Cannot delete protected system setting", 403);
    }

    const setting = await SystemSetting.findOneAndDelete({ key });
    if (!setting) return errorResponse(res, "Setting not found", 404);

    return successResponse(res, null, "Setting deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete setting", 500);
  }
};

const PUBLIC_SETTINGS = [
  ["booking.enabled", "booking.enabled"],
  ["service.ev_passenger.enabled", "service.ev_passenger.enabled"],
  ["service.taxi.enabled", "service.taxi.enabled"],
  ["service.ev_passenger.allowed_vehicle_types", "service.ev_passenger.allowed_vehicle_types"],
  ["service.taxi.allowed_vehicle_types", "service.taxi.allowed_vehicle_types"],
  ["service.ev_goods.enabled", "service.ev_goods.enabled"],
  ["service.goods_taxi.enabled", "service.goods_taxi.enabled"],
  ["service.ev_goods.allowed_vehicle_types", "service.ev_goods.allowed_vehicle_types"],
  ["service.goods_taxi.allowed_vehicle_types", "service.goods_taxi.allowed_vehicle_types"],
  ["service.ev_goods.max_capacity_kg", "service.ev_goods.max_capacity_kg"],
  ["service.goods_taxi.max_capacity_kg", "service.goods_taxi.max_capacity_kg"],
  ["payment.enabled", "payment.enabled"],
  ["customer.registrationenabled", "customer.registrationEnabled"],
  ["driver.enabled", "driver.enabled"],
  ["notification.enabled", "notification.enabled"],
  ["system.maintenancemode", "system.maintenanceMode"],
  ["system.supportphone", "system.supportPhone"],
  ["system.supportemail", "system.supportEmail"]
];

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.find({
      key: { $in: PUBLIC_SETTINGS.map(([key]) => key) },
      isActive: true
    });
    
    const config = settings.reduce((acc, curr) => {
      const match = PUBLIC_SETTINGS.find(([key]) => key === curr.key);
      if (match) {
        acc[match[1]] = curr.value;
      }
      return acc;
    }, {});

    // Sync EV Passenger <-> EV Goods for seamless backward compatibility
    if (config["service.ev_passenger.enabled"] === undefined && config["service.ev_goods.enabled"] !== undefined) {
      config["service.ev_passenger.enabled"] = config["service.ev_goods.enabled"];
    } else if (config["service.ev_goods.enabled"] === undefined && config["service.ev_passenger.enabled"] !== undefined) {
      config["service.ev_goods.enabled"] = config["service.ev_passenger.enabled"];
    }

    // Sync Taxi <-> Goods Taxi for seamless backward compatibility
    if (config["service.taxi.enabled"] === undefined && config["service.goods_taxi.enabled"] !== undefined) {
      config["service.taxi.enabled"] = config["service.goods_taxi.enabled"];
    } else if (config["service.goods_taxi.enabled"] === undefined && config["service.taxi.enabled"] !== undefined) {
      config["service.goods_taxi.enabled"] = config["service.taxi.enabled"];
    }

    if (config["service.ev_passenger.allowed_vehicle_types"] === undefined) {
      config["service.ev_passenger.allowed_vehicle_types"] = [
        "electric-rickshaw",
        "electric-passenger-three-wheeler",
        "other-electric-passenger"
      ];
    }
    if (config["service.taxi.allowed_vehicle_types"] === undefined) {
      config["service.taxi.allowed_vehicle_types"] = [
        "sedan",
        "hatchback",
        "suv"
      ];
    }

    if (config["service.ev_goods.allowed_vehicle_types"] === undefined) {
      config["service.ev_goods.allowed_vehicle_types"] = [
        "electric-cargo-loader",
        "electric-goods-e-rickshaw",
        "electric-mini-cargo-carrier"
      ];
    }
    if (config["service.goods_taxi.allowed_vehicle_types"] === undefined) {
      config["service.goods_taxi.allowed_vehicle_types"] = [
        "mini-pickup",
        "tata-ace",
        "cargo-pickup",
        "goods-loading-taxi"
      ];
    }

    return successResponse(res, { config }, "Public config fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch public config", 500);
  }
};
