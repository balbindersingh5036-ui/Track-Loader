/**
 * Cloudinary Image Optimization Utility
 * Automatically injects f_auto,q_auto transformations and dimensions to reduce
 * payload sizes and improve rendering performance.
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!url || typeof url !== "string") return url;

  // Only transform Cloudinary URLs that have not already been transformed
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    const parts = url.split("/image/upload/");
    if (parts.length === 2) {
      // Check if already transformed
      if (/^f_auto|^q_auto|^w_|^h_|^c_/.test(parts[1])) {
        return url;
      }

      const transforms = ["f_auto", "q_auto"];
      if (options.width) transforms.push(`w_${options.width}`);
      if (options.height) transforms.push(`h_${options.height}`);
      if (options.crop) transforms.push(`c_${options.crop}`);

      return `${parts[0]}/image/upload/${transforms.join(",")}/${parts[1]}`;
    }
  }

  return url;
};

export default getOptimizedImageUrl;
