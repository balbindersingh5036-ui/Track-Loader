/**
 * Vehicle Photo Extraction and Carousel Utilities
 * Extracts, sanitizes, and prepares vehicle photos for display.
 */

export const MAX_VEHICLE_PHOTOS = 4;

/**
 * Extracts and sanitizes vehicle photo URLs from a vehicle record.
 * Handles `vehicleImages`, `photos`, and `vehicleImage`.
 * Deduplicates and limits to maximum 4 photos.
 */
export const extractVehiclePhotoUrls = (vehicle) => {
  if (!vehicle || typeof vehicle !== "object") return [];

  const candidateList = [];

  if (Array.isArray(vehicle.vehicleImages)) {
    candidateList.push(...vehicle.vehicleImages);
  }
  if (Array.isArray(vehicle.photos)) {
    candidateList.push(...vehicle.photos);
  }
  if (typeof vehicle.vehicleImage === "string") {
    candidateList.push(vehicle.vehicleImage);
  }

  const uniqueUrls = [];
  const seen = new Set();

  for (const item of candidateList) {
    let url = "";
    if (typeof item === "string") {
      url = item.trim();
    } else if (item && typeof item === "object" && typeof item.url === "string") {
      url = item.url.trim();
    }

    if (
      url &&
      (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) &&
      !seen.has(url)
    ) {
      seen.add(url);
      uniqueUrls.push(url);
    }
  }

  return uniqueUrls.slice(0, MAX_VEHICLE_PHOTOS);
};

/**
 * Constructs an infinite loop buffer for a list of photos.
 * If 0 or 1 photo: returns the array as-is.
 * If >= 2 photos: returns [last, ...photos, first].
 */
export const createInfinitePhotoBuffer = (photos) => {
  if (!Array.isArray(photos) || photos.length <= 1) return photos || [];
  return [photos[photos.length - 1], ...photos, photos[0]];
};

/**
 * Calculates next real photo index given the current real index and photo count.
 */
export const getNextPhotoIndex = (currentIndex, photoCount) => {
  if (photoCount <= 1) return 0;
  return (currentIndex + 1) % photoCount;
};

/**
 * Calculates previous real photo index given the current real index and photo count.
 */
export const getPrevPhotoIndex = (currentIndex, photoCount) => {
  if (photoCount <= 1) return 0;
  return (currentIndex - 1 + photoCount) % photoCount;
};
