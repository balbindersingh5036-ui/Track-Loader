import { env } from "../config/env.js";

/**
 * In-memory Route Cache
 * Key: `${profile}_${pickupLat},${pickupLon}_${dropLat},${dropLon}` (normalized to 4 decimal places)
 * TTL: 12 hours
 */
const routeCache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

export const clearRouteCache = () => {
  routeCache.clear();
};

export const getRouteCacheStats = () => ({
  size: routeCache.size,
  maxSize: MAX_CACHE_SIZE,
  ttlMs: CACHE_TTL_MS
});

/**
 * Safe API key masker for logs
 */
export const maskApiKey = (key) => {
  if (!key || typeof key !== "string") return "NOT_SET";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

/**
 * Decode standard Google/ORS encoded polyline into [latitude, longitude] pairs
 */
export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([Number((lat * 1e-5).toFixed(6)), Number((lng * 1e-5).toFixed(6))]);
  }
  return poly;
}

/**
 * Validate latitude and longitude values
 */
export const validateCoordinates = (coords, label = "Coordinates") => {
  if (!coords || typeof coords !== "object") {
    const error = new Error(`Invalid ${label}: Object with latitude and longitude is required.`);
    error.status = 400;
    throw error;
  }

  const lat = Number(coords.latitude);
  const lon = Number(coords.longitude);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    const error = new Error(`Invalid ${label} latitude: Must be a number between -90 and 90.`);
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    const error = new Error(`Invalid ${label} longitude: Must be a number between -180 and 180.`);
    error.status = 400;
    throw error;
  }

  return { latitude: lat, longitude: lon };
};

/**
 * Resolve routing profile based on vehicle type or profile string
 * Defaults to driving-hgv (heavy goods vehicles / trucks)
 */
export const resolveRoutingProfile = (vehicleType, explicitProfile) => {
  if (explicitProfile && typeof explicitProfile === "string") {
    const normalized = explicitProfile.trim().toLowerCase();
    if (["driving-hgv", "driving-car"].includes(normalized)) {
      return normalized;
    }
  }

  // All freight / commercial trucks in LoadBalbin use driving-hgv for truck-safe routing
  return "driving-hgv";
};

/**
 * Generate normalized cache key
 */
const getCacheKey = (profile, pickup, drop) => {
  const pLat = pickup.latitude.toFixed(4);
  const pLon = pickup.longitude.toFixed(4);
  const dLat = drop.latitude.toFixed(4);
  const dLon = drop.longitude.toFixed(4);
  return `${profile}_${pLat},${pLon}_${dLat},${dLon}`;
};

/**
 * Resolves the full OpenRouteService directions endpoint URL,
 * safely handling bases with or without trailing /v2 or trailing slashes.
 */
export const resolveOrsEndpoint = (baseUrl, profile) => {
  const cleanBase = (baseUrl || "https://api.openrouteservice.org/v2").trim().replace(/\/+$/, "");
  const baseWithV2 = cleanBase.endsWith("/v2") ? cleanBase : `${cleanBase}/v2`;
  return `${baseWithV2}/directions/${profile}/json`;
};

/**
 * Calculate Road Distance and Route via OpenRouteService Directions V2 API
 * 
 * @param {Object} params
 * @param {Object} params.pickup - { latitude, longitude }
 * @param {Object} params.drop - { latitude, longitude }
 * @param {string} [params.vehicleType] - e.g. "large-truck", "medium-truck", "pickup"
 * @param {string} [params.profile] - e.g. "driving-hgv"
 * @param {number} [params.timeoutMs=15000] - Request timeout
 * @returns {Promise<Object>} Route information
 */
export const calculateRoadRoute = async ({
  pickup,
  drop,
  vehicleType,
  profile: requestedProfile,
  timeoutMs = 15000
}) => {
  const validPickup = validateCoordinates(pickup, "pickup");
  const validDrop = validateCoordinates(drop, "drop");

  // Handle identical coordinates (zero distance)
  const isIdentical =
    Math.abs(validPickup.latitude - validDrop.latitude) < 0.00001 &&
    Math.abs(validPickup.longitude - validDrop.longitude) < 0.00001;

  const profile = resolveRoutingProfile(vehicleType, requestedProfile);

  if (isIdentical) {
    return {
      distanceMeters: 0,
      distanceKm: 0,
      durationSeconds: 0,
      durationMinutes: 0,
      geometry: "",
      coordinates: [[validPickup.latitude, validPickup.longitude]],
      profile,
      calculatedAt: new Date().toISOString(),
      cached: false
    };
  }

  // Check in-memory cache
  const cacheKey = getCacheKey(profile, validPickup, validDrop);
  const now = Date.now();
  if (routeCache.has(cacheKey)) {
    const cachedEntry = routeCache.get(cacheKey);
    if (now - cachedEntry.timestamp < CACHE_TTL_MS) {
      return {
        ...cachedEntry.data,
        cached: true
      };
    }
    routeCache.delete(cacheKey);
  }

  const apiKey = env.ors?.apiKey;
  if (!apiKey) {
    const error = new Error("OpenRouteService API key is missing. Please configure ORS_API_KEY in backend/.env.");
    error.status = 500;
    error.isOrsConfigError = true;
    throw error;
  }

  const baseUrl = env.ors?.baseUrl || "https://api.openrouteservice.org/v2";
  const endpoint = resolveOrsEndpoint(baseUrl, profile);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // OpenRouteService expects coordinates in [longitude, latitude] order
  const requestBody = {
    coordinates: [
      [validPickup.longitude, validPickup.latitude],
      [validDrop.longitude, validDrop.latitude]
    ]
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    if (fetchErr.name === "AbortError") {
      const error = new Error(`Routing request to OpenRouteService timed out after ${timeoutMs / 1000} seconds.`);
      error.status = 504;
      error.isTimeout = true;
      throw error;
    }
    const error = new Error(`Failed to connect to OpenRouteService routing provider: ${fetchErr.message}`);
    error.status = 502;
    error.isNetworkError = true;
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error("Invalid response received from OpenRouteService routing provider.");
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const status = response.status;
    const orsError = data?.error;
    const orsMessage = typeof orsError === "object" ? orsError.message : (data?.message || "");

    if (status === 401 || status === 403) {
      const error = new Error("OpenRouteService authentication failed. Please check ORS_API_KEY.");
      error.status = 502;
      error.isAuthError = true;
      throw error;
    }

    if (status === 429) {
      const error = new Error("Routing service quota limit exceeded (HTTP 429). Please retry in a few moments.");
      error.status = 429;
      error.isRateLimited = true;
      throw error;
    }

    const detailMsg = orsMessage ? `: ${orsMessage}` : "";
    const error = new Error(`No road route found between selected pickup and drop locations for heavy vehicles${detailMsg}`);
    error.status = 400;
    error.orsStatusCode = status;
    error.orsErrorCode = typeof orsError === "object" ? orsError.code : undefined;
    throw error;
  }

  const route = data?.routes?.[0];
  if (!route || !route.summary) {
    const error = new Error("OpenRouteService returned an empty route. Please verify your coordinates.");
    error.status = 400;
    throw error;
  }

  const distanceMeters = Math.round(route.summary.distance);
  const distanceKm = Number((route.summary.distance / 1000).toFixed(2));
  const durationSeconds = Math.round(route.summary.duration);
  const durationMinutes = Number((route.summary.duration / 60).toFixed(2));
  const geometry = typeof route.geometry === "string" ? route.geometry : "";
  const coordinates = decodePolyline(geometry);

  const result = {
    distanceMeters,
    distanceKm,
    durationSeconds,
    durationMinutes,
    geometry,
    coordinates,
    profile,
    calculatedAt: new Date().toISOString(),
    cached: false
  };

  // Cache management
  if (routeCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
  routeCache.set(cacheKey, { timestamp: now, data: result });

  return result;
};

export default {
  calculateRoadRoute,
  validateCoordinates,
  decodePolyline,
  clearRouteCache,
  getRouteCacheStats,
  maskApiKey
};

