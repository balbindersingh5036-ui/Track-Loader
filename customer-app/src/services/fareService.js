import api from './api';

const fareService = {
  async getFare(vehicleType) {
    const { data } = await api.get(`/fares/${encodeURIComponent(vehicleType)}`);
    return data.data.fare;
  }
};

export default fareService;
