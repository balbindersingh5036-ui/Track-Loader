import { io } from "socket.io-client";
import { getApiBaseUrl } from "./api";

let socket;
const bookingListeners = new Set();
const notificationListeners = new Set();
const bookingRooms = new Set();
const BOOKING_EVENTS = [
  "booking:created",
  "booking:accepted",
  "booking:rejected",
  "booking:started",
  "booking:completed",
  "booking:cancelled",
  "booking:assigned"
];

export const connectSocket = (token) => {
  if (socket?.connected) return socket;
  socket?.disconnect();
  const socketUrl = getApiBaseUrl().replace(/\/api\/?$/, "");
  socket = io(socketUrl, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true
  });
  for (const eventName of BOOKING_EVENTS) {
    socket.on(eventName, (payload) => {
      for (const listener of bookingListeners) listener(eventName, payload);
    });
  }
  socket.on("notification:new", (payload) => {
    for (const listener of notificationListeners) listener(payload);
  });
  socket.on("connect", () => {
    for (const bookingId of bookingRooms) socket.emit("joinBooking", bookingId);
  });
  return socket;
};

export const getSocket = () => socket;

export const subscribeToBookingEvents = (listener) => {
  bookingListeners.add(listener);
  return () => bookingListeners.delete(listener);
};

export const subscribeToNotifications = (listener) => {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
};

export const joinBookingRoom = (bookingId) => {
  if (!bookingId) return;
  bookingRooms.add(bookingId);
  if (socket?.connected) socket.emit("joinBooking", bookingId);
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = undefined;
  bookingRooms.clear();
};
