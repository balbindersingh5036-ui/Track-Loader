import api from "./api";

export const notificationService = {
  async getNotifications(params = {}) {
    const { data } = await api.get("/notifications", { params });
    return data.data;
  },
  async getUnreadCount() {
    const { data } = await api.get("/notifications/unread-count");
    return data.data.count;
  },
  async getNotification(id) {
    const { data } = await api.get(`/notifications/${encodeURIComponent(id)}`);
    return data.data.notification;
  },
  async markAsRead(id) {
    const { data } = await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
    return data.data.notification;
  },
  async markAllAsRead() {
    const { data } = await api.patch("/notifications/read-all");
    return data;
  }
};
export default notificationService;
