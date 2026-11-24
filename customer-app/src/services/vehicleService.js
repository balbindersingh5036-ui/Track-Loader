import api from "./api";

export const vehicleService = {
  async getVehicles(filters = {}) {
    try {
      const { data } = await api.get("/vehicles", { params: filters });
      return data.data.vehicles;
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "";
      if (
        err?.response?.status === 400 &&
        errorMsg.includes("Invalid service category") &&
        filters?.serviceCategory
      ) {
        console.warn(
          `[vehicleService.getVehicles] Backend rejected canonical serviceCategory '${filters.serviceCategory}'. ` +
          "Retrying request without serviceCategory for legacy backend compatibility..."
        );
        const fallbackFilters = { ...filters };
        delete fallbackFilters.serviceCategory;
        const { data: fallbackData } = await api.get("/vehicles", { params: fallbackFilters });
        return fallbackData.data.vehicles;
      }
      throw err;
    }
  },
  async getVehicle(id) {
    const { data } = await api.get(`/vehicles/${encodeURIComponent(id)}`);
    return data.data.vehicle;
  },
  async getVehiclesByType(vehicleType) {
    const { data } = await api.get(`/vehicles/type/${encodeURIComponent(vehicleType)}`);
    return data.data.vehicles;
  }
};
export default vehicleService;
