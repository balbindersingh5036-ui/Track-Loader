import { calculateRoadRoute, validateCoordinates } from "../services/routingService.js";
import { errorResponse } from "../utils/response.js";

/**
 * Controller: Calculate road distance and route via OpenRouteService
 * POST /api/routes/calculate-distance
 */
export const calculateDistance = async (req, res) => {
  try {
    const { pickup, drop, vehicleType, profile } = req.body;

    if (!pickup || typeof pickup !== "object") {
      return errorResponse(res, "Pickup location is required with latitude and longitude", 400);
    }

    if (!drop || typeof drop !== "object") {
      return errorResponse(res, "Drop location is required with latitude and longitude", 400);
    }

    // Validate coordinate formats
    try {
      validateCoordinates(pickup, "pickup");
      validateCoordinates(drop, "drop");
    } catch (coordErr) {
      return errorResponse(res, coordErr.message, 400);
    }

    const routeResult = await calculateRoadRoute({
      pickup,
      drop,
      vehicleType,
      profile
    });

    return res.status(200).json({
      success: true,
      distanceKm: routeResult.distanceKm,
      distanceMeters: routeResult.distanceMeters,
      durationSeconds: routeResult.durationSeconds,
      durationMinutes: routeResult.durationMinutes,
      profile: routeResult.profile,
      geometry: routeResult.geometry,
      coordinates: routeResult.coordinates,
      calculatedAt: routeResult.calculatedAt,
      cached: Boolean(routeResult.cached),
      data: routeResult
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return errorResponse(res, error.message || "Failed to calculate road route", statusCode);
  }
};

export default {
  calculateDistance
};

