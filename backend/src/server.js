import "./ipv4.js";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { createServer } from "http";
import { initializeSocket } from "./sockets/socket.js";

const startServer = async () => {
  try {
    await connectDB();

    const httpServer = createServer(app);
    initializeSocket(httpServer);

    httpServer.listen(env.port, () => {
      console.log(
        `LoadBalbin Backend running on http://localhost:${env.port}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();