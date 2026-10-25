import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "./documentSigner.js";

export const sanitizeDriverDocumentResponse = (driver, { includeSignedUrls = false } = {}) => {
  if (!driver?.documents) return driver;

  for (const key of ["idProof", "drivingLicense"]) {
    const document = driver.documents[key];
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

  delete driver.documents.vehicleRegistration;
  delete driver.documents.insurance;
  return driver;
};
