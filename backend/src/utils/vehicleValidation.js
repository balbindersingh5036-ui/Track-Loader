/**
 * Validates whether a vehicle make/model string is a legitimate name
 * (e.g. "Tata Ace Gold", "Mahindra Jeeto", "Eicher Pro 2049", "Ashok Leyland Dost")
 * and not an arbitrary numeric code (e.g. "300"), registration plate, or database ID.
 */
export const isValidVehicleModel = (model, vehicleNumber = null, vehicleId = null) => {
  if (!model || typeof model !== "string") return false;
  const trimmed = model.trim();
  if (trimmed.length < 2) return false;

  // Must contain alphabetic characters (e.g. "Tata 407", "Jeeto", "Dost+")
  if (!/[a-zA-Z]/.test(trimmed)) return false;

  // Reject purely numeric or punctuation strings (e.g. "300", "12345", "--")
  if (/^[0-9\s.,-]+$/.test(trimmed)) return false;

  // Reject 24-character hexadecimal MongoDB ObjectIds
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return false;

  // Reject if it matches the vehicle's registration number
  if (vehicleNumber && trimmed.toUpperCase() === String(vehicleNumber).trim().toUpperCase()) {
    return false;
  }

  // Reject if it matches the vehicle ID
  if (vehicleId && trimmed === String(vehicleId).trim()) {
    return false;
  }

  return true;
};

/**
 * Standard commercial vehicle make suggestions
 */
export const COMMON_VEHICLE_MAKES = [
  "Tata",
  "Mahindra",
  "Ashok Leyland",
  "Eicher",
  "BharatBenz",
  "Force",
  "Isuzu",
  "Piaggio",
  "Maruti Suzuki"
];

/**
 * Normalizes Make and Model into a full display model string
 */
export const formatFullVehicleModel = (make, model) => {
  const trimmedMake = (make || "").trim();
  const trimmedModel = (model || "").trim();

  if (!trimmedMake) return trimmedModel;
  if (!trimmedModel) return trimmedMake;

  if (trimmedModel.toLowerCase().startsWith(trimmedMake.toLowerCase())) {
    return trimmedModel;
  }

  return `${trimmedMake} ${trimmedModel}`;
};

