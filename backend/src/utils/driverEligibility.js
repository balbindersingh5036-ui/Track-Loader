export const hasApprovedDriverIdentityDocuments = (driver) =>
  driver?.documents?.idProof?.status === "approved" &&
  driver?.documents?.drivingLicense?.status === "approved";

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
