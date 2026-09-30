import api from "./api";

const authService = {
  async register(details) {
    const { data } = await api.post("/auth/register", details);
    return data.data;
  },
  async login(credentials) {
    const { data } = await api.post("/auth/login", credentials);
    return data.data;
  },
  async getMe() {
    const { data } = await api.get("/auth/me");
    return data.data.user;
  }
};

export default authService;
export { authService };
