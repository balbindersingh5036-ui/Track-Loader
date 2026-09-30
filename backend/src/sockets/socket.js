import { Server } from "socket.io";
import { verifyToken } from "../utils/generateToken.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select("-password");

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: Invalid or inactive user"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user._id})`);

    // Join user-specific room
    socket.join(`user:${socket.user._id.toString()}`);

    // Join booking rooms explicitly if authorized (client can request to join)
    socket.on("joinBooking", async (bookingId) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        let authorized = false;

        if (socket.user.role === "admin") {
          authorized = true;
        } else if (socket.user.role === "customer" && booking.customer.toString() === socket.user._id.toString()) {
          authorized = true;
        } else if (socket.user.role === "driver") {
          const driver = await Driver.findOne({ user: socket.user._id });
          if (driver && booking.driver && booking.driver.toString() === driver._id.toString()) {
            authorized = true;
          }
        }

        if (authorized) {
          socket.join(`booking:${bookingId}`);
          console.log(`User ${socket.user._id} joined booking room ${bookingId}`);
        } else {
          console.log(`User ${socket.user._id} unauthorized to join booking room ${bookingId}`);
        }
      } catch (error) {
        console.error("Socket joinBooking error:", error);
      }
    });

    socket.on("leaveBooking", (bookingId) => {
      socket.leave(`booking:${bookingId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

export const emitToBooking = (bookingId, event, data) => {
  if (io) {
    io.to(`booking:${bookingId.toString()}`).emit(event, data);
  }
};
