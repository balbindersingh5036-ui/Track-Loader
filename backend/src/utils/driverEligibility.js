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

export const checkDriverAssignableToVehicle = (driver, vehicle, agency = null) => {
  if (!driver) {
    return { eligible: false, message: "Driver not found" };
  }
  if (!driver.isActive || driver.approvalStatus !== "approved") {
    return {
      eligible: false,
      message: "Driver must be active and approved by Super Admin before assignment"
    };
  }
  if (!hasApprovedDriverIdentityDocuments(driver)) {
    return {
      eligible: false,
      message: "Driver Aadhaar and Driving Licence must both be approved by Super Admin before assignment"
    };
  }
  if (driver.agency) {
    if (agency && String(driver.agency?._id || driver.agency) !== String(agency?._id || agency)) {
      return {
        eligible: false,
        message: "Driver belongs to another agency"
      };
    }
    if (driver.agencyAssociation?.status !== "approved") {
      return {
        eligible: false,
        message: "Driver agency association must be accepted before assignment"
      };
    }
  }

  if (!vehicle) {
    return { eligible: false, message: "Vehicle not found" };
  }
  if (!vehicle.isActive) {
    return {
      eligible: false,
      message: "Vehicle must be active before assigning a driver"
    };
  }
  if (agency && vehicle.agency && String(vehicle.agency?._id || vehicle.agency) !== String(agency?._id || agency)) {
    return {
      eligible: false,
      message: "Vehicle belongs to another agency"
    };
  }
  if (driver.agency && vehicle.agency && String(driver.agency?._id || driver.agency) !== String(vehicle.agency?._id || vehicle.agency)) {
    return {
      eligible: false,
      message: "Driver and vehicle must belong to the same agency"
    };
  }
  if (!hasApprovedVehicleDocuments(vehicle)) {
    return {
      eligible: false,
      message: "Vehicle registration and insurance must both be approved before assigning a driver"
    };
  }

  return { eligible: true };
};

export const isDriverAssignableToVehicle = (driver, vehicle, agency = null) =>
  checkDriverAssignableToVehicle(driver, vehicle, agency).eligible;

export const checkDriverEligibleForDispatch = (driver, vehicle, agency = null) => {
  const assignCheck = checkDriverAssignableToVehicle(driver, vehicle, agency);
  if (!assignCheck.eligible) {
    return assignCheck;
  }
  if (!vehicle.isAvailable) {
    return {
      eligible: false,
      message: "Vehicle is currently on a trip or unavailable"
    };
  }
  if (!vehicle.driver || String(vehicle.driver?._id || vehicle.driver) !== String(driver._id)) {
    return {
      eligible: false,
      message: "An approved and available vehicle must be assigned to the driver before dispatch"
    };
  }
  if (agency && (agency.approvalStatus !== "approved" || !agency.isActive)) {
    return {
      eligible: false,
      message: "Agency must be active and approved before dispatch"
    };
  }
  return { eligible: true };
};

export const isDriverEligibleForDispatch = (driver, vehicle, agency = null) =>
  checkDriverEligibleForDispatch(driver, vehicle, agency).eligible;

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
