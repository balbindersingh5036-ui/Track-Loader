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
  async uploadProfileImage(uri) {
    const formData = new FormData();
    formData.append("image", {
      uri,
      name: "profile.jpg",
      type: "image/jpeg"
    });
    const { data } = await api.post("/uploads/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return data.imageUrl;
  },
  async changePassword(passwords) {
    const { data } = await api.put("/users/change-password", passwords);
    return data;
  },
  async getBookingsSummary() {
    const { data } = await api.get("/users/bookings-summary");
    return data.data;
  }
};
export default userService;
