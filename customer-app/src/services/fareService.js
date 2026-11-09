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
  async getQuotes({ distanceKm, weight, vehicleType } = {}) {
    const { data } = await api.post("/fares/quotes", { distanceKm, weight, vehicleType });
    return data.data;
  }
};

export default fareService;
