import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";
import { env } from "../config/env.js";

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided"
      });
    }

    if (!env.cloudinary.apiKey) {
      return res.status(503).json({
        success: false,
        message: "Image upload service is not configured"
      });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "loadbalbin_profiles" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", {
            message: error.message || error.error?.message || "Unknown error",
            http_code: error.http_code || error.error?.http_code || null,
            name: error.name || null
          });
          return res.status(500).json({
            success: false,
            message: "Failed to upload image. Please try again."
          });
        }

        res.json({
          success: true,
          imageUrl: result.secure_url
        });
      }
    );

    Readable.from(req.file.buffer).pipe(stream);
  } catch (error) {
    next(error);
  }
};
