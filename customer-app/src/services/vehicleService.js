import api from "./api";

export const vehicleService = {
  async getVehicles(filters = {}) {
    const { data } = await api.get("/vehicles", { params: filters });
    return data.data.vehicles;
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
