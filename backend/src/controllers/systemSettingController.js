import SystemSetting from "../models/SystemSetting.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { setSetting } from "../services/systemSettingService.js";

const PROTECTED_KEYS = [
  "system.maintenanceMode",
  "booking.enabled",
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

const PUBLIC_KEYS = [
  "booking.enabled",
  "payment.enabled",
  "customer.registrationEnabled",
  "driver.enabled",
  "notification.enabled",
  "system.maintenanceMode",
  "system.supportPhone",
  "system.supportEmail"
];

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.find({ key: { $in: PUBLIC_KEYS }, isActive: true });
    
    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return successResponse(res, { config }, "Public config fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch public config", 500);
  }
};
