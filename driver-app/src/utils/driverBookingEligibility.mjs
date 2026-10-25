const requiredDocuments = [
  { key: "idProof", label: "Identity Proof (Aadhaar)" },
  { key: "drivingLicense", label: "Driving Licence" }
];

export const getDriverBookingEligibility = (driver) => {
  if (!driver) {
    return {
      eligible: false,
      title: "Driver profile unavailable",
      message: "We could not load your driver profile. Refresh your profile or sign in again."
    };
  }

  if (!driver.isActive) {
    return {
      eligible: false,
      title: "Driver account inactive",
      message: "Contact LoadBalbin support to restore your account before receiving booking requests."
    };
  }

  if (driver.approvalStatus !== "approved") {
    const accountStatus = driver.approvalStatus || "pending";
    const message = accountStatus === "rejected"
      ? (driver.rejectionReason || "Contact support for details about your driver account review.")
      : accountStatus === "suspended"
        ? "Your account is suspended. Contact LoadBalbin support for assistance."
        : "Your driver account must be approved by the administrator before you can receive booking requests.";
    return {
      eligible: false,
      title: `Driver account ${accountStatus}`,
      message
    };
  }

  const unapprovedDocuments = requiredDocuments.filter(
    ({ key }) => driver.documents?.[key]?.status !== "approved"
  );
  if (unapprovedDocuments.length) {
    return {
      eligible: false,
      title: "Identity verification required",
      message: unapprovedDocuments.map(({ key, label }) => {
        const document = driver.documents?.[key];
        const status = document?.status || "not_uploaded";
        if (status === "rejected") {
          return `${label} was rejected${document.rejectionReason ? `: ${document.rejectionReason}` : ". Please re-upload it from Profile."}`;
        }
        if (status === "pending") return `${label} is pending administrator review.`;
        return `${label} must be uploaded from Profile.`;
      }).join(" ")
    };
  }

  return { eligible: true, title: "", message: "" };
};
