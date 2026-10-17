import cloudinary from "../config/cloudinary.js";
import { env } from "../config/env.js";

/**
 * Generate a short-lived authenticated URL for viewing/downloading private KYC assets.
 * Uses Cloudinary SDK's private_download_url to enforce time-limited access.
 * 
 * @param {string} publicId - The Cloudinary public_id (e.g., 'loadbalbin_kyc/abc123xyz')
 * @param {string} [format='pdf'] - The asset format/extension
 * @param {number} [expirySeconds=300] - Lifespan of the signed link in seconds (default 5 minutes)
 * @param {string} [resourceType='image'] - Resource type ('image' or 'raw')
 * @returns {string} Signed temporary delivery URL
 */
export const generateSignedDocumentUrl = (publicId, format = "pdf", expirySeconds = 300, resourceType = "image") => {
  if (!publicId) return "";

  // If already a signed or non-Cloudinary asset, return as is
  if (typeof publicId === "string" && publicId.startsWith("http") && !publicId.includes("cloudinary.com")) {
    return publicId;
  }

  const cleanPublicId = typeof publicId === "string" && publicId.includes("loadbalbin_kyc/")
    ? publicId.split("/loadbalbin_kyc/")[1]
      ? "loadbalbin_kyc/" + publicId.split("/loadbalbin_kyc/")[1].split(".")[0]
      : publicId
    : publicId;

  const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;
  const cleanFormat = (format || "pdf").toLowerCase().replace(/^\./, "");

  // Generate time-limited signed delivery URL via Cloudinary's private_download_url
  return cloudinary.utils.private_download_url(cleanPublicId, cleanFormat, {
    resource_type: resourceType || "image",
    type: "authenticated",
    expires_at: expiresAt
  });
};

/**
 * Extract public_id and format from a Cloudinary URL if needed.
 */
export const extractCloudinaryAssetInfo = (url) => {
  if (!url || typeof url !== "string") return null;
  
  // Example: https://res.cloudinary.com/demo/image/upload/v1234/loadbalbin_kyc/sample.pdf
  const match = url.match(/(loadbalbin_(?:kyc|profiles)\/[^.?#]+)(?:\.([a-zA-Z0-9]+))?/);
  if (match) {
    return {
      publicId: match[1],
      format: match[2] || "pdf"
    };
  }
  return null;
};
