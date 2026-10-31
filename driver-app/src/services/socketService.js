import { io } from 'socket.io-client';
import { getToken } from '../utils/authStorage';
import bookingService from './bookingService';
import agencyService from './agencyService';

let socket;
let currentRole = null;
let currentToken = null;
const listeners = new Set();
const bookingRooms = new Set();
const BOOKING_EVENTS = [
  'booking:created',
  'booking:accepted',
  'booking:rejected',
  'booking:started',
  'booking:completed',
  'booking:cancelled',
  'booking:assigned'
];

const normalizeBookingId = (bookingId) => {
  const id = typeof bookingId === 'string'
    ? bookingId.trim()
    : bookingId && typeof bookingId.toString === 'function'
      ? bookingId.toString().trim()
      : '';
  return /^[a-f\d]{24}$/i.test(id) ? id : null;
};

const notifyListeners = (eventName, payload) => {
  for (const listener of listeners) {
    try {
      listener(eventName, payload);
    } catch (error) {
      console.error('Socket event listener failed:', error);
    }
  }
};

const joinRequestedRooms = () => {
  if (!socket?.connected) return;
  bookingRooms.forEach((bookingId) => socket.emit('joinBooking', bookingId));
};

export const connectSocket = (token, role) => {
  if (role) currentRole = role;
  if (!token) {
    notifyListeners('socket:error', new Error('Authentication is required for realtime updates.'));
    return null;
  }
  if (socket && currentToken === token) {
    if (!socket.connected && !socket.active) socket.connect();
    return socket;
  }
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = undefined;
    bookingRooms.clear();
  }

  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!configuredApiUrl) {
    currentToken = token;
    notifyListeners('socket:error', new Error('Realtime service is not configured.'));
    return null;
  }
  const socketUrl = configuredApiUrl.replace(/\/api\/?$/, '');
  currentToken = token;
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true
  });

  for (const eventName of BOOKING_EVENTS) {
    socket.on(eventName, (payload) => notifyListeners(eventName, payload));
  }
  socket.on('notification:new', (payload) => notifyListeners('notification:new', payload));
  socket.on('connect', async () => {
    joinRequestedRooms();
    try {
      const tokenInStorage = await getToken();
      if (!tokenInStorage) return;

      const activeRole = currentRole;
      if (activeRole === 'agency') {
        const response = await agencyService.getAgencyBookings();
        (response.data?.data?.bookings || [])
          .filter((booking) =>
            booking.bookingStatus === 'accepted' ||
            booking.bookingStatus === 'in-progress' ||
            booking.status === 'accepted' ||
            booking.status === 'in_progress'
          )
          .forEach((booking) => joinBookingRoom(booking._id));
      } else if (activeRole === 'driver') {
        const response = await bookingService.getMyBookings({ page: 1, limit: 100 });
        (response.data?.data?.bookings || [])
          .filter((booking) =>
            booking.bookingStatus === 'accepted' ||
            booking.bookingStatus === 'in-progress'
          )
          .forEach((booking) => joinBookingRoom(booking._id));
      }
    } catch (error) {
      notifyListeners('socket:error', error);
    }
  });
  socket.on('connect_error', (error) => {
    notifyListeners('socket:error', error);
  });
  return socket;
};

export const joinBookingRoom = (bookingId) => {
  const id = normalizeBookingId(bookingId);
  if (!id) return false;
  if (bookingRooms.has(id)) return true;
  bookingRooms.add(id);
  if (socket?.connected) socket.emit('joinBooking', id);
  return true;
};

export const leaveBookingRoom = (bookingId) => {
  const id = normalizeBookingId(bookingId);
  if (!id || !bookingRooms.has(id)) return false;
  bookingRooms.delete(id);
  if (socket?.connected) socket.emit('leaveBooking', id);
  return true;
};

export const subscribeToSocketEvents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket?.removeAllListeners();
  socket = undefined;
  currentToken = null;
  currentRole = null;
  bookingRooms.clear();
};
