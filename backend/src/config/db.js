import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.mongodbUri);

    console.log(
      `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};
