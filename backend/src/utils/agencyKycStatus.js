const documentTypes = [
  "ownerAadhaar",
  "businessRegistration",
  "tradeLicense",
  "gstCertificate",
  "taxId"
];

export const serializeAgencyKycStatus = (agency) => {
  if (!agency) return null;

  const documents = Object.fromEntries(documentTypes.map((key) => {
    const document = agency.documents?.[key];
    const submitted = Boolean(document?.publicId || document?.url);

    return [key, {
      status: submitted ? document.status || "pending" : "not_uploaded",
      submittedAt: document?.submittedAt || null,
      reviewedAt: document?.reviewedAt || null,
      rejectionReason: document?.rejectionReason || ""
    }];
  }));

  return {
    approvalStatus: agency.approvalStatus || "pending",
    rejectionReason: agency.rejectionReason || "",
    documents
  };
};
