const requiredDocuments = [
  { key: "idProof", label: "Identity Proof (Aadhaar)" },
  { key: "drivingLicense", label: "Driving Licence" }
];

export const getDriverBookingEligibility = (driver, vehicles = []) => {
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

  // Agency association check for agency-linked driver
  if (driver.agency) {
    const assocStatus = driver.agencyAssociation?.status || "pending";
    if (assocStatus === "rejected") {
      return {
        eligible: false,
        title: "Agency Association Rejected",
        message: driver.agencyAssociation?.rejectionReason
          ? `Your selected transport agency rejected your joining request: "${driver.agencyAssociation.rejectionReason}". You can select and request another verified agency below.`
          : "Your selected transport agency rejected your joining request. You can select and request another verified agency below."
      };
    }
    if (assocStatus === "pending") {
      return {
        eligible: false,
        title: "Pending Agency Association",
        message: "Your joining request is currently awaiting review and acceptance by your selected agency admin."
      };
    }
  }

  // Super Admin Account Approval check
  if (driver.approvalStatus !== "approved") {
    const accountStatus = driver.approvalStatus || "pending";
    const message = accountStatus === "rejected"
      ? (driver.rejectionReason || "Contact support for details about your driver account review.")
      : accountStatus === "suspended"
        ? "Your account is suspended. Contact LoadBalbin support for assistance."
        : "Your driver account must be approved by the Super Admin before you can receive booking requests.";
    return {
      eligible: false,
      title: `Driver account ${accountStatus}`,
      message
    };
  }

  // Identity documents check
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

  // Vehicle assignment check
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    const eligibleVehicles = vehicles.filter((v) => {
      if (!v || !v.isActive || !v.isAvailable) return false;
      const rcOk = v.documents?.registration?.status === "approved";
      const insOk = v.documents?.insurance?.status === "approved";
      return rcOk && insOk;
    });

    if (eligibleVehicles.length === 0) {
      return {
        eligible: false,
        title: "Vehicle Assignment Pending",
        message: "An active and available vehicle with approved RC and insurance documents must be assigned before dispatch."
      };
    }
  }

  return { eligible: true, title: "", message: "" };
};

export const getDriverStatusIndicators = (driver, vehicles = []) => {
  const isAgencyLinked = Boolean(driver?.agency);

  // 1. Agency Association
  const assocStatus = isAgencyLinked ? (driver?.agencyAssociation?.status || "pending") : "none";
  const agencyAssociation = {
    status: assocStatus,
    label: !isAgencyLinked ? "N/A (Independent)" : (assocStatus === "approved" ? "Approved" : assocStatus === "rejected" ? "Rejected" : "Pending"),
    rejectionReason: driver?.agencyAssociation?.rejectionReason || "",
    decidedAt: driver?.agencyAssociation?.decidedAt || null
  };

  // 2. Aadhaar (Identity Proof)
  const idDoc = driver?.documents?.idProof;
  const idStatus = idDoc?.status || "not_uploaded";
  const aadhaar = {
    status: idStatus,
    label: idStatus === "approved" ? "Approved" : idStatus === "rejected" ? "Rejected" : idStatus === "pending" ? "Pending" : "Upload Required",
    rejectionReason: idDoc?.rejectionReason || ""
  };

  // 3. Driving Licence
  const dlDoc = driver?.documents?.drivingLicense;
  const dlStatus = dlDoc?.status || "not_uploaded";
  const drivingLicense = {
    status: dlStatus,
    label: dlStatus === "approved" ? "Approved" : dlStatus === "rejected" ? "Rejected" : dlStatus === "pending" ? "Pending" : "Upload Required",
    rejectionReason: dlDoc?.rejectionReason || ""
  };

  // 4. Super Admin Account Approval
  const adminApprovalStatus = driver?.approvalStatus || "pending";
  const superAdminApproval = {
    status: adminApprovalStatus,
    label: adminApprovalStatus === "approved" ? "Approved" : adminApprovalStatus === "rejected" ? "Rejected" : adminApprovalStatus === "suspended" ? "Suspended" : "Pending",
    rejectionReason: driver?.rejectionReason || ""
  };

  // 5. Vehicle Assignment
  const eligibleVehicles = (vehicles || []).filter((v) => {
    if (!v || !v.isActive || !v.isAvailable) return false;
    const rcOk = v.documents?.registration?.status === "approved";
    const insOk = v.documents?.insurance?.status === "approved";
    return rcOk && insOk;
  });

  const vehicleAssignment = {
    status: eligibleVehicles.length > 0 ? "eligible" : "pending",
    label: eligibleVehicles.length > 0 ? "Eligible" : "Pending",
    count: eligibleVehicles.length
  };

  return {
    agencyAssociation,
    aadhaar,
    drivingLicense,
    superAdminApproval,
    vehicleAssignment
  };
};
