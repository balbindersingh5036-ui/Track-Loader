import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "./documentSigner.js";

const CATEGORY_LABELS = {
  "mini-truck": "Mini Truck",
  "pickup": "Pickup Truck",
  "small-truck": "Small Truck",
  "medium-truck": "Medium Truck",
  "large-truck": "Large Heavy Truck"
};

export const getCleanVehicleDisplayName = (vehicle) => {
  if (!vehicle) return "Commercial Vehicle";

  const rawModel = typeof vehicle.vehicleModel === "string" ? vehicle.vehicleModel.trim() : "";
  const regNumber = typeof vehicle.vehicleNumber === "string" ? vehicle.vehicleNumber.trim() : "";
  const vehicleId = vehicle._id ? String(vehicle._id).trim() : "";
  const capacityVal = vehicle.loadCapacity?.value != null ? String(vehicle.loadCapacity.value).trim() : "";

  // Reject arbitrary numeric strings (e.g. "300"), registration numbers, vehicle IDs, or capacity
  const isNumericOnly = /^[0-9\s.,-]+$/.test(rawModel);
  const hasLetters = /[a-zA-Z]/.test(rawModel);
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(rawModel);
  const matchesReg = Boolean(regNumber && rawModel.toUpperCase() === regNumber.toUpperCase());
  const matchesId = Boolean(vehicleId && rawModel === vehicleId);
  const matchesCapacity = Boolean(capacityVal && (rawModel === capacityVal || rawModel === `${capacityVal}kg` || rawModel === `${capacityVal}ton`));

  const isValidModel =
    rawModel.length >= 2 &&
    hasLetters &&
    !isNumericOnly &&
    !isObjectId &&
    !matchesReg &&
    !matchesId &&
    !matchesCapacity;

  if (isValidModel) {
    return rawModel;
  }

  const category = vehicle.vehicleType;
  return CATEGORY_LABELS[category] || (category ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Commercial Vehicle");
};

export const sanitizeVehicleDocumentResponse = (vehicle, { includeSignedUrls = false } = {}) => {
  if (!vehicle) return vehicle;

  vehicle.displayName = getCleanVehicleDisplayName(vehicle);

  delete vehicle.registrationDocument;
  delete vehicle.insuranceDocument;

  for (const key of ["registration", "insurance"]) {
    const document = vehicle.documents?.[key];
    if (!document) continue;
    let publicId = document.publicId;
    let format = document.format || "pdf";
    if (!publicId && document.url) {
      const asset = extractCloudinaryAssetInfo(document.url);
      if (asset) {
        publicId = asset.publicId;
        format = asset.format;
      }
    }
    document.viewUrl = includeSignedUrls && publicId?.startsWith("loadbalbin_kyc/")
      ? generateSignedDocumentUrl(publicId, format, 300, document.resourceType || "image")
      : null;
    document.status = document.url || document.publicId
      ? document.status || "pending"
      : "not_uploaded";
    document.uploadedBy = typeof document.uploadedBy === "object"
      ? document.uploadedBy?.name || null
      : null;
    document.reviewedBy = typeof document.reviewedBy === "object"
      ? document.reviewedBy?.name || null
      : null;
    delete document.url;
    delete document.publicId;
  }

  return vehicle;
};
