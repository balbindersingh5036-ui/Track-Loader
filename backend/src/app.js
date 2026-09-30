import express from "express";
import cors from "cors";
import helmet from "helmet";

import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import adminVehicleRoutes from "./routes/adminVehicleRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminBookingRoutes from "./routes/adminBookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import systemSettingRoutes from "./routes/systemSettingRoutes.js";
import publicConfigRoutes from "./routes/publicConfigRoutes.js";
import fareRoutes from "./routes/fareRoutes.js";
import adminFareRoutes from "./routes/adminFareRoutes.js";
import { checkMaintenanceMode } from "./middleware/maintenanceMiddleware.js";
import {
  notFound,
  errorHandler
} from "./middleware/errorMiddleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Raw body parser for webhook
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      if (req.originalUrl.includes("/webhook")) {
        req.rawBody = buf.toString();
      }
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply maintenance mode middleware globally for APIs
app.use("/api", checkMaintenanceMode);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to LoadBalbin API"
  });
});

app.use("/api/config", publicConfigRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/admin/vehicles", adminVehicleRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin/payments", adminPaymentRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/settings", systemSettingRoutes);
app.use("/api/fares", fareRoutes);
app.use("/api/admin/fares", adminFareRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
