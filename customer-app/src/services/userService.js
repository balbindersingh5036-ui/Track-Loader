import api from "./api";
import { Platform } from "react-native";

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
    
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      const file = new File([blob], "profile.jpg", { type: blob.type || "image/jpeg" });
      formData.append("image", file);
    } else {
      formData.append("image", {
        uri,
        name: "profile.jpg",
        type: "image/jpeg"
      });
    }

    const { data } = await api.post("/uploads/image", formData);
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
