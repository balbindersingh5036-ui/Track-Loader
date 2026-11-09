/**
 * In-memory sliding window rate limiter for routing endpoints
 * Protects OpenRouteService free quota (40 requests / minute)
 */
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 35;

export const routeRateLimiter = (req, res, next) => {
  const identifier = req.user?._id?.toString() || req.ip || req.headers["x-forwarded-for"] || "anonymous";
  const now = Date.now();

  const record = rateLimitMap.get(identifier) || { timestamps: [] };

  // Remove timestamps outside current window
  const validTimestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      message: "Too many route calculation requests. Please wait a minute before trying again."
    });
  }

  validTimestamps.push(now);
  rateLimitMap.set(identifier, { timestamps: validTimestamps });

  // Cleanup old keys periodically if map grows large
  if (rateLimitMap.size > 5000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.timestamps.every((ts) => now - ts >= WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }

  next();
};

export const clearRateLimitCache = () => {
  rateLimitMap.clear();
};

