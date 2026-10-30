export const hasApprovedDriverIdentityDocuments = (driver) =>
  driver?.documents?.idProof?.status === "approved" &&
  driver?.documents?.drivingLicense?.status === "approved";

export const isDriverAssociationApproved = (driver) => {
  if (!driver?.agency) return true;
  if (driver.agencyAssociation && typeof driver.agencyAssociation.status === "string") {
    return driver.agencyAssociation.status === "approved";
  }
  return true;
};

export const isDriverEligibleForAssignment = (driver) =>
  Boolean(
    driver &&
    driver.isActive &&
    driver.approvalStatus === "approved" &&
    hasApprovedDriverIdentityDocuments(driver)
  );

export const hasApprovedVehicleDocuments = (vehicle) =>
  vehicle?.documents?.registration?.status === "approved" &&
  vehicle?.documents?.insurance?.status === "approved";

export const isVehicleEligibleForBookings = (vehicle) =>
  Boolean(vehicle && vehicle.isActive && hasApprovedVehicleDocuments(vehicle));

export const isDriverVehicleEligibleForBookings = (driver, vehicle) =>
  isDriverEligibleForAssignment(driver) &&
  isVehicleEligibleForBookings(vehicle);

export const checkDriverOnlineEligibility = (driver, vehicles = [], agency = null) => {
  if (!driver) {
    return { eligible: false, message: "Driver profile not found" };
  }
  if (!driver.isActive || driver.approvalStatus !== "approved") {
    return {
      eligible: false,
      message: "Your account is not approved or inactive. Only approved drivers can go online."
    };
  }
  if (!hasApprovedDriverIdentityDocuments(driver)) {
    return {
      eligible: false,
      message: "Both identity documents (Aadhaar and Driving Licence) must be approved before going online."
    };
  }
  if (driver.agency) {
    if (driver.agencyAssociation?.status === "rejected") {
      return {
        eligible: false,
        message: driver.agencyAssociation.rejectionReason
          ? `Agency has rejected your association request: ${driver.agencyAssociation.rejectionReason}`
          : "Agency has rejected your association request."
      };
    }
    if (driver.agencyAssociation?.status !== "approved") {
      return {
        eligible: false,
        message: "Your agency association request is pending agency approval."
      };
    }
    if (agency && (agency.approvalStatus !== "approved" || !agency.isActive)) {
      return {
        eligible: false,
        message: "Your agency is not active or approved."
      };
    }
  }

  const eligibleVehicles = (vehicles || []).filter((v) => {
    if (!v || !v.isActive || !v.isAvailable) return false;
    if (driver.agency && v.agency && String(v.agency?._id || v.agency) !== String(driver.agency?._id || driver.agency)) {
      return false;
    }
    return hasApprovedVehicleDocuments(v);
  });

  if (eligibleVehicles.length === 0) {
    return {
      eligible: false,
      message: "An active and available vehicle with approved registration and insurance documents must be assigned before going online."
    };
  }

  return { eligible: true };
};
