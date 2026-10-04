import mongoose from "mongoose";
import { env } from "./env.js";
import { ensureAdminUser } from "../../seeds/adminSeed.js";

export const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.mongodbUri);

    console.log(
      `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
    );

    await ensureAdminUser();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};
