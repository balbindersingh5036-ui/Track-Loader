import api from "./api";

export const configService = {
  async getPublicConfig() {
    const { data } = await api.get("/config/public");
    return data.data.config || {};
  }
};
export default configService;
