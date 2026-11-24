import api from "./api";

const fareService = {
  async getFares(params = {}) {
    const { data } = await api.get("/fares", { params });
    return data.data?.fares || [];
  },
  async getFare(vehicleType) {
    const { data } = await api.get(`/fares/${encodeURIComponent(vehicleType)}`);
    return data.data?.fare || null;
  },
  async getQuotes({
    distanceKm,
    weight,
    vehicleType,
    serviceCategory,
    loadingRequired = false,
    unloadingRequired = false
  } = {}) {
    const payload = {
      distanceKm,
      weight,
      ...(vehicleType ? { vehicleType } : {}),
      ...(serviceCategory ? { serviceCategory } : {}),
      loadingRequired,
      unloadingRequired
    };

    console.log("[fareService.getQuotes] Request payload:", JSON.stringify(payload));

    try {
      const { data } = await api.post("/fares/quotes", payload);
      return data.data;
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "";
      console.warn(`[fareService.getQuotes] API returned ${err?.response?.status || "error"}: ${errorMsg}`);

      // Backend production compatibility fallback:
      // If deployed backend is running pre-canonical categories and rejects with 'Invalid service category',
      // retry without serviceCategory so quotes for all available vehicles are returned.
      if (
        err?.response?.status === 400 &&
        errorMsg.includes("Invalid service category") &&
        serviceCategory
      ) {
        console.warn(
          `[fareService.getQuotes] Deployed backend rejected canonical category '${serviceCategory}'. ` +
          "Retrying request without serviceCategory for legacy backend compatibility..."
        );
        const fallbackPayload = { ...payload };
        delete fallbackPayload.serviceCategory;
        const { data: fallbackData } = await api.post("/fares/quotes", fallbackPayload);
        return fallbackData.data;
      }

      throw err;
    }
  }
};

export default fareService;
