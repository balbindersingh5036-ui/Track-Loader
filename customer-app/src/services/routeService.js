import api from './api';

// Client-side cache to strictly respect Nominatim usage policy (no repeated queries)
const geocodeCache = new Map();
const MAX_GEOCODE_CACHE = 200;
let lastNominatimRequestTime = 0;

/**
 * Throttle upstream Nominatim calls to max 1 req/sec per public usage policy
 */
async function throttleNominatim() {
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastNominatimRequestTime = Date.now();
}

function setCache(key, value) {
  if (geocodeCache.size >= MAX_GEOCODE_CACHE) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, value);
}

export const routeService = {
  /**
   * Authoritative backend route & distance calculation via OpenRouteService
   * @param {Object} pickup { latitude, longitude, address }
   * @param {Object} drop { latitude, longitude, address }
   * @param {string} [vehicleType]
   */
  async calculateDistance(pickup, drop, vehicleType) {
    const payload = {
      pickup: {
        latitude: Number(pickup.latitude),
        longitude: Number(pickup.longitude),
        address: pickup.address || ''
      },
      drop: {
        latitude: Number(drop.latitude),
        longitude: Number(drop.longitude),
        address: drop.address || ''
      }
    };
    if (vehicleType) {
      payload.vehicleType = vehicleType;
    }

    const { data } = await api.post('/routes/calculate-distance', payload);
    return data.data;
  },

  /**
   * Free address search using OpenStreetMap Nominatim with strict caching & 1 req/sec throttling
   * @param {string} query
   */
  async searchAddress(query) {
    if (!query || query.trim().length < 2) return [];
    const normalizedKey = `search_${query.trim().toLowerCase()}`;

    if (geocodeCache.has(normalizedKey)) {
      return geocodeCache.get(normalizedKey);
    }

    try {
      await throttleNominatim();
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&countrycodes=in&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LoadBalbin-Customer-App/1.0 (https://loadbalbin.com; support@loadbalbin.com)'
        }
      });
      if (!response.ok) return [];
      const results = await response.json();
      const mapped = results.map((item) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
      setCache(normalizedKey, mapped);
      return mapped;
    } catch {
      return [];
    }
  },

  /**
   * Free reverse geocoding using OpenStreetMap Nominatim with caching & throttling
   * @param {number} latitude
   * @param {number} longitude
   */
  async reverseGeocode(latitude, longitude) {
    const latRound = Number(latitude).toFixed(4);
    const lonRound = Number(longitude).toFixed(4);
    const cacheKey = `rev_${latRound}_${lonRound}`;

    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    try {
      await throttleNominatim();
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'LoadBalbin-Customer-App/1.0 (https://loadbalbin.com; support@loadbalbin.com)'
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      const name = data.display_name || null;
      if (name) setCache(cacheKey, name);
      return name;
    } catch {
      return null;
    }
  }
};

export default routeService;
