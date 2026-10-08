import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

if (
  env.cloudinary.cloudName &&
  env.cloudinary.apiKey &&
  env.cloudinary.apiSecret
) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName.trim(),
    api_key: env.cloudinary.apiKey.trim(),
    api_secret: env.cloudinary.apiSecret.trim(),
    secure: true
  });
}

export default cloudinary;
