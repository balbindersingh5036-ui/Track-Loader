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

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "loadbalbin_profiles",
      resource_type: "auto"
    });

    res.json({
      success: true,
      imageUrl: result.secure_url
    });
  } catch (error) {
    console.error("Cloudinary Upload Error Raw:", error);
    console.error("Cloudinary Upload Error:", {
      message: error.message || "Unknown error",
      http_code: error.http_code || null,
      name: error.name || null
    });
    
    if (error.http_code && error.http_code >= 400 && error.http_code < 500) {
      return res.status(400).json({
        success: false,
        message: `Invalid image upload request to provider: ${error.message}`
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload image. Please try again."
    });
  }
};
