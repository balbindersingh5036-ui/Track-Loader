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
  async uploadProfileImage(assetOrUri) {
    const formData = new FormData();
    const asset = typeof assetOrUri === "string" ? { uri: assetOrUri } : (assetOrUri || {});
    const uri = asset.uri;

    if (Platform.OS === "web") {
      if (asset.file instanceof File) {
        formData.append("image", asset.file);
      } else if (uri) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const mime = asset.mimeType || blob.type || "image/jpeg";
        const filename = asset.fileName || "profile.jpg";
        const file = new File([blob], filename, { type: mime });
        formData.append("image", file);
      } else {
        throw new Error("No image asset selected");
      }
    } else {
      if (!uri) throw new Error("No image URI provided");
      let fileUri = uri;
      if (Platform.OS === "android" && !fileUri.startsWith("file://") && !fileUri.startsWith("content://")) {
        fileUri = `file://${fileUri}`;
      }
      const filename = asset.fileName || fileUri.split("/").pop() || "profile.jpg";
      const mime = asset.mimeType || "image/jpeg";
      formData.append("image", {
        uri: fileUri,
        name: filename,
        type: mime
      });
    }

    const { data } = await api.post("/uploads/image", formData, {
      headers: Platform.OS === "web" ? { "Content-Type": undefined } : { "Content-Type": "multipart/form-data" }
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
