import { io } from 'socket.io-client';
import { getToken } from '../utils/authStorage';
import bookingService from './bookingService';
import agencyService from './agencyService';

let socket;
let currentRole = null;
const listeners = new Set();
const BOOKING_EVENTS = [
  'booking:created',
  'booking:accepted',
  'booking:rejected',
  'booking:started',
  'booking:completed',
  'booking:cancelled',
  'booking:assigned'
];

export const connectSocket = (token, role) => {
  if (role) currentRole = role;
  if (socket?.connected) return socket;
  socket?.disconnect();
  const socketUrl = process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '');
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true
  });

  for (const eventName of BOOKING_EVENTS) {
    socket.on(eventName, (payload) => {
      listeners.forEach((listener) => listener(eventName, payload));
    });
  }
  socket.on('notification:new', (payload) => {
    listeners.forEach((listener) => listener('notification:new', payload));
  });
  socket.on('connect', async () => {
    try {
      const tokenInStorage = await getToken();
      if (!tokenInStorage) return;

      const activeRole = role || currentRole;
      if (activeRole === 'agency') {
        const response = await agencyService.getAgencyBookings();
        (response.data?.data?.bookings || [])
          .filter((booking) =>
            booking.bookingStatus === 'accepted' ||
            booking.bookingStatus === 'in-progress' ||
            booking.status === 'accepted' ||
            booking.status === 'in_progress'
          )
          .forEach((booking) => socket.emit('joinBooking', booking._id));
      } else if (activeRole === 'driver') {
        const response = await bookingService.getMyBookings({ page: 1, limit: 100 });
        (response.data?.data?.bookings || [])
          .filter((booking) =>
            booking.bookingStatus === 'accepted' ||
            booking.bookingStatus === 'in-progress'
          )
          .forEach((booking) => socket.emit('joinBooking', booking._id));
      }
    } catch (error) {
      listeners.forEach((listener) => listener('socket:error', error));
    }
  });
  socket.on('connect_error', (error) => {
    listeners.forEach((listener) => listener('socket:error', error));
  });
  return socket;
};

export const subscribeToSocketEvents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = undefined;
};
