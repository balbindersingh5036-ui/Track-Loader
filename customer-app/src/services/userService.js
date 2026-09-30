import api from "./api";

export const userService = {
  async getProfile() {
    const { data } = await api.get("/users/profile");
    return data.data;
  },
  async updateProfile(profile) {
    const { data } = await api.put("/users/profile", profile);
    return data.data;
  },
  async changePassword(passwords) {
    const { data } = await api.put("/users/change-password", passwords);
    return data;
  }
};
export default userService;
