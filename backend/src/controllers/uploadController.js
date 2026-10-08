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
    let detailedDetails = {
      code: error.http_code,
      name: error.name
    };
    let detailedMessage = error.message;

    // If Cloudinary SDK swallows the 403 body, let's fetch manually to see the exact error.
    if (error.http_code === 403) {
      try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const params_to_sign = {
          folder: "loadbalbin_profiles",
          timestamp: timestamp,
        };
        const signature = cloudinary.utils.api_sign_request(params_to_sign, env.cloudinary.apiSecret);
        
        const form = new FormData();
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        form.append("file", "data:" + req.file.mimetype + ";base64," + b64);
        form.append("api_key", env.cloudinary.apiKey);
        form.append("timestamp", timestamp);
        form.append("signature", signature);
        form.append("folder", "loadbalbin_profiles");
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, {
          method: "POST",
          body: form
        });
        
        const bodyText = await response.text();
        let parsedBody;
        try { parsedBody = JSON.parse(bodyText); } catch(e) { parsedBody = bodyText; }
        
        detailedMessage = parsedBody?.error?.message || detailedMessage;
        detailedDetails.providerMessage = detailedMessage;
        detailedDetails.providerHeader = response.headers.get('x-cld-error') || null;
      } catch (fallbackError) {
        console.error("Fallback fetch failed", fallbackError);
      }
    }

    if (error.http_code && error.http_code >= 400 && error.http_code < 500) {
      return res.status(400).json({
        success: false,
        message: "Image provider rejected upload",
        details: detailedDetails
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload image. Please try again."
    });
  }
};
