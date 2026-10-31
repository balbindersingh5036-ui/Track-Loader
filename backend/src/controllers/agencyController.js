import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { hashPassword } from "../utils/password.js";
import {
  isDriverEligibleForAssignment,
  isVehicleEligibleForBookings,
  checkDriverAssignableToVehicle,
  isDriverAssignableToVehicle,
  isDriverEligibleForDispatch
} from "../utils/driverEligibility.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";
import { sanitizeDriverDocumentResponse } from "../utils/driverDocumentResponse.js";
import {
  removeUploadedVehiclePhotoAssets,
  uploadVehiclePhotos
} from "../utils/vehiclePhotoStorage.js";
import { getActualDriverUserFilter, isActualDriverProfile } from "../utils/actualDriver.js";
import { notifyCustomer, notifyDriver } from "../services/notificationService.js";
import { emitToUser } from "../sockets/socket.js";
import { extractCloudinaryAssetInfo, generateSignedDocumentUrl } from "../utils/documentSigner.js";
import {
  removeUploadedAsset,
  uploadPrivateDocument,
  validatePrivateDocument
} from "./documentController.js";

// Helper to retrieve current authenticated user's agency
const getAgencyForUser = async (userId) => {
  return await Agency.findOne({ owner: userId });
};
const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;
const agencyDocumentTypes = ["ownerAadhaar", "businessRegistration", "tradeLicense", "gstCertificate", "taxId"];

const serializeAgencyDocument = (document) => {
  const doc = document || {};
  const hasDocument = Boolean(doc.publicId || doc.url);
  const asset = doc.publicId
    ? { publicId: doc.publicId, format: doc.format, resourceType: doc.resourceType }
    : extractCloudinaryAssetInfo(doc.url);
  const privateAsset = asset?.publicId?.startsWith("loadbalbin_kyc/");

  return {
    status: hasDocument ? doc.status || "pending" : "not_uploaded",
    format: doc.format || asset?.format || "",
    maskedNumber: doc.maskedNumber || "",
    submittedAt: doc.submittedAt || null,
    reviewedAt: doc.reviewedAt || null,
    reviewedBy: typeof doc.reviewedBy === "object" ? doc.reviewedBy?.name || null : null,
    uploadedBy: typeof doc.uploadedBy === "object"
      ? doc.uploadedBy?.name || doc.uploadedBy?._id?.toString?.() || doc.uploadedBy?.toString?.() || null
      : doc.uploadedBy?.toString?.() || null,
    rejectionReason: doc.rejectionReason || "",
    viewUrl: privateAsset
      ? generateSignedDocumentUrl(asset.publicId, asset.format || "pdf", 300, doc.resourceType || asset.resourceType || "image")
      : null
  };
};

const serializeAgencyOwnerView = (agency) => {
  const plainAgency = toPlainObject(agency);
  return {
    ...plainAgency,
    documents: Object.fromEntries(
      agencyDocumentTypes.map((docType) => [docType, serializeAgencyDocument(plainAgency.documents?.[docType])])
    )
  };
};

export const getVerifiedAgencies = async (_req, res) => {
  try {
    const agencies = await Agency.find({
      approvalStatus: "approved",
      isActive: true
    })
      .select("_id agencyName city")
      .sort({ agencyName: 1 })
      .lean();

    return successResponse(res, { agencies }, "Verified agencies fetched");
  } catch (error) {
    console.error("Verified agency list error:", error);
    return errorResponse(res, "Failed to fetch verified agencies", 500);
  }
};

// Agency Profile & Registration
export const registerAgency = async (req, res) => {
  const uploadedAssets = [];
  let createdAgency;
  let roleUpdateAttempted = false;
  let uploadInProgress = false;
  try {
    if (req.user?.role !== "customer") {
      return errorResponse(res, "Only customer accounts can apply to register an agency", 403);
    }

    const { agencyName, phone, email, address, city } = req.body;

    if (Object.hasOwn(req.body || {}, "documents")) {
      return errorResponse(res, "Agency documents must be submitted as multipart files through the authenticated private upload endpoint", 400);
    }

    const files = req.files || {};
    if (!files.ownerAadhaar?.[0]) {
      return errorResponse(res, "An owner Aadhaar document is required to register an agency", 400);
    }
    if (!agencyName || typeof agencyName !== "string" || !agencyName.trim()) {
      return errorResponse(res, "Agency name is required", 400);
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return errorResponse(res, "Phone number is required", 400);
    }

    for (const docType of agencyDocumentTypes) {
      if (files[docType]?.[0]) validatePrivateDocument(files[docType][0]);
    }

    const emailQuery = typeof email === "string" && email.trim()
      ? [{ email: email.trim().toLowerCase() }]
      : [];
    const existing = await Agency.findOne({
      $or: [{ owner: req.user._id }, { phone: phone.trim() }, ...emailQuery]
    });
    if (existing) {
      return errorResponse(res, "Agency with this owner, phone number, or email already exists", 409);
    }

    const documents = {};
    for (const docType of agencyDocumentTypes) {
      const file = files[docType]?.[0];
      if (!file) continue;

      uploadInProgress = true;
      const { asset, detected } = await uploadPrivateDocument(file);
      uploadedAssets.push(asset);
      documents[docType] = {
        url: asset.secure_url,
        publicId: asset.public_id,
        resourceType: asset.resource_type || "image",
        format: asset.format || detected.format,
        status: "pending",
        submittedAt: new Date(),
        uploadedBy: req.user._id,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: ""
      };
    }
    uploadInProgress = false;

    createdAgency = await Agency.create({
      owner: req.user._id,
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      email: typeof email === "string" ? email.trim().toLowerCase() : "",
      address: typeof address === "string" ? address.trim() : "",
      city: typeof city === "string" ? city.trim() : "",
      documents
    });

    // Update user role to agency if not already admin
    if (req.user.role !== "admin") {
      roleUpdateAttempted = true;
      const updatedUser = await User.findByIdAndUpdate(req.user._id, { role: "agency" });
      if (!updatedUser) throw new Error("User role update did not find the registering user");
    }

    return successResponse(
      res,
      { agency: serializeAgencyOwnerView(createdAgency) },
      "Agency registered successfully and pending approval",
      201
    );
  } catch (error) {
    let cleanupIncomplete = false;
    if (createdAgency?._id) {
      try {
        const deletion = await Agency.deleteOne({ _id: createdAgency._id });
        if (deletion?.deletedCount === 0) cleanupIncomplete = true;
      } catch (cleanupError) {
        cleanupIncomplete = true;
        console.error("Agency registration rollback failed:", cleanupError.code || cleanupError.name || "unknown error");
      }
    }
    if (roleUpdateAttempted) {
      try {
        const restoredUser = await User.findByIdAndUpdate(req.user._id, { role: req.user.role });
        if (!restoredUser) cleanupIncomplete = true;
      } catch (cleanupError) {
        cleanupIncomplete = true;
        console.error("Agency registration role rollback failed:", cleanupError.code || cleanupError.name || "unknown error");
      }
    }
    const cleanupResults = await Promise.all(uploadedAssets.map((asset) => removeUploadedAsset(asset)));
    if (cleanupResults.some((success) => !success)) cleanupIncomplete = true;

    console.error("Agency registration failed:", error.code || error.name || "unknown error");
    const primaryMessage = error.statusCode ? error.message : "Failed to register agency";
    const message = cleanupIncomplete
      ? `${primaryMessage}; rollback or uploaded document cleanup was incomplete`
      : primaryMessage;
    const statusCode = error.statusCode || (error.code === 11000 ? 409 : uploadInProgress ? 502 : 500);
    return errorResponse(res, message, statusCode);
  }
};

export const getMyAgency = async (req, res) => {
  try {
    const agency = await Agency.findOne({ owner: req.user._id })
      .populate("documents.ownerAadhaar.reviewedBy", "name")
      .populate("documents.ownerAadhaar.uploadedBy", "name")
      .populate("documents.businessRegistration.reviewedBy", "name")
      .populate("documents.businessRegistration.uploadedBy", "name")
      .populate("documents.tradeLicense.reviewedBy", "name")
      .populate("documents.tradeLicense.uploadedBy", "name")
      .populate("documents.gstCertificate.reviewedBy", "name")
      .populate("documents.gstCertificate.uploadedBy", "name")
      .populate("documents.taxId.reviewedBy", "name")
      .populate("documents.taxId.uploadedBy", "name");
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    return successResponse(res, { agency: serializeAgencyOwnerView(agency) }, "Agency profile fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency profile", 500);
  }
};

export const updateMyAgency = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }
    if (Object.hasOwn(req.body || {}, "documents")) {
      return errorResponse(res, "Agency documents must be submitted through the authenticated private upload endpoint", 400);
    }

    const { agencyName, address, city } = req.body;
    const updates = {};
    if (typeof agencyName === "string" && agencyName.trim()) updates.agencyName = agencyName.trim();
    if (address !== undefined) updates.address = address.trim();
    if (city !== undefined) updates.city = city.trim();

    const updated = await Agency.findByIdAndUpdate(agency._id, { $set: updates }, { new: true });
    return successResponse(
      res,
      { agency: serializeAgencyOwnerView(updated) },
      "Agency profile updated"
    );
  } catch (error) {
    return errorResponse(res, "Failed to update agency profile", 500);
  }
};

// Helper to reliably resolve agency association status for drivers
export const resolveAgencyAssociation = (driver) => {
  const assoc = driver.agencyAssociation;
  if (assoc?.status === "approved" || assoc?.status === "rejected" || assoc?.status === "pending") {
    return {
      status: assoc.status,
      rejectionReason: assoc.rejectionReason || "",
      decidedAt: assoc.decidedAt || assoc.decisionAt || null,
      decisionAt: assoc.decisionAt || assoc.decidedAt || null,
      reviewedBy: assoc.reviewedBy || null
    };
  }

  // Fallback for agency-linked drivers:
  // If driver was already approved by Super Admin in legacy data, mark association approved.
  // Otherwise, if attached to an agency, they are pending agency approval.
  const fallbackStatus = driver.approvalStatus === "approved" ? "approved" : "pending";
  return {
    status: fallbackStatus,
    rejectionReason: assoc?.rejectionReason || "",
    decidedAt: assoc?.decidedAt || null,
    decisionAt: assoc?.decisionAt || null,
    reviewedBy: assoc?.reviewedBy || null
  };
};

// Agency-managed Drivers
export const getAgencyDrivers = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const actualDriverUserFilter = await getActualDriverUserFilter();
    const drivers = await Driver.find({
      agency: agency._id,
      ...actualDriverUserFilter
    })
      .populate("user", "name phone email profileImage isActive")
      .populate("documents.idProof.uploadedBy", "name")
      .populate("documents.drivingLicense.uploadedBy", "name")
      .sort({ createdAt: -1 });

    const assignedVehicles = await Vehicle.find({
      agency: agency._id,
      driver: { $in: drivers.map((driver) => driver._id) }
    })
      .select("_id driver vehicleNumber vehicleModel vehicleType")
      .lean();
    const vehicleByDriver = new Map(
      assignedVehicles.map((vehicle) => [String(vehicle.driver), {
        id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleModel: vehicle.vehicleModel,
        vehicleType: vehicle.vehicleType
      }])
    );

    const enhancedDrivers = drivers.map((d) => {
      const dObj = d.toObject();
      dObj.agencyAssociation = resolveAgencyAssociation(dObj);
      dObj.assignedVehicle = vehicleByDriver.get(String(d._id)) || null;
      return sanitizeDriverDocumentResponse(dObj);
    });

    return successResponse(res, { drivers: enhancedDrivers }, "Agency drivers fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency drivers", 500);
  }
};

export const createAgencyDriver = async (req, res) => {
  let createdUser;
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { fullName, phone, email, password, address, emergencyContact } = req.body;
    if (Object.hasOwn(req.body || {}, "documents")) {
      return errorResponse(res, "Documents must be submitted through the authenticated private upload endpoint", 400);
    }
    if (!fullName || !phone || !password) {
      return errorResponse(res, "Driver full name, phone number, and password are required", 400);
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const duplicateCriteria = [{ phone: phone.trim() }];
    if (normalizedEmail) duplicateCriteria.push({ email: normalizedEmail });
    const existingUser = await User.findOne({ $or: duplicateCriteria });
    if (existingUser) {
      return errorResponse(res, "User with this phone number or email already exists", 409);
    }

    const hashedPassword = await hashPassword(password);
    createdUser = await User.create({
      name: fullName.trim(),
      phone: phone.trim(),
      email: normalizedEmail || undefined,
      password: hashedPassword,
      role: "driver"
    });

    const now = new Date();
    const driver = await Driver.create({
      user: createdUser._id,
      agency: agency._id,
      agencyAssociation: {
        status: "approved",
        rejectionReason: "",
        decidedAt: now,
        decisionAt: now,
        reviewedBy: req.user._id
      },
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      address: address ? address.trim() : "",
      emergencyContact: emergencyContact || { name: "", phone: "" },
      approvalStatus: "pending" // Preserving Super Admin approval authority
    });

    return successResponse(res, { driver }, "Driver created by agency and pending Super Admin approval", 201);
  } catch (error) {
    if (createdUser?._id) {
      try {
        await User.deleteOne({ _id: createdUser._id });
      } catch (rollbackError) {
        console.error("Failed to roll back incomplete agency driver creation:", rollbackError);
      }
    }
    if (error.code === 11000) {
      return errorResponse(res, "User with this phone number or email already exists", 409);
    }
    console.error("Agency driver creation error:", error);
    return errorResponse(res, "Failed to create driver", 500);
  }
};

export const updateAgencyDriverDocuments = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid driver ID", 400);
    }

    const driver = await Driver.findOne({ _id: id, agency: agency._id });
    if (!driver) {
      return errorResponse(res, "Driver not found in your agency", 404);
    }
    return errorResponse(
      res,
      "Direct document URLs are not accepted. Use the authenticated private document upload endpoint.",
      400
    );
  } catch (error) {
    return errorResponse(res, "Failed to update driver documents", 500);
  }
};

// Agency-managed Vehicles
export const getAgencyVehicles = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const vehicles = await Vehicle.find({ agency: agency._id })
      .populate(
        "driver",
        "fullName phone rating approvalStatus isActive documents.idProof.status documents.drivingLicense.status"
      )
      .populate("documents.registration.uploadedBy", "name")
      .populate("documents.insurance.uploadedBy", "name")
      .sort({ createdAt: -1 });

    return successResponse(res, {
      vehicles: vehicles.map((vehicle) => sanitizeVehicleDocumentResponse(vehicle.toObject()))
    }, "Agency vehicles fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency vehicles", 500);
  }
};

const parseVehicleCapacity = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseVehiclePhotoList = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const createAgencyVehicle = async (req, res) => {
  let uploadedAssets = [];
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }
    if (agency.approvalStatus !== "approved" || !agency.isActive) {
      return errorResponse(res, "Only an active, approved agency may assign drivers", 403);
    }

    const {
      vehicleNumber,
      vehicleModel,
      vehicleType,
      loadCapacity,
      bodyType,
      vehicleImage,
      vehicleImages
    } = req.body;
    const parsedCapacity = parseVehicleCapacity(loadCapacity);
    const incomingVehicleImages = parseVehiclePhotoList(vehicleImages);

    if (!vehicleNumber || !vehicleModel || !vehicleType || !parsedCapacity) {
      return errorResponse(res, "Required vehicle details missing", 400);
    }
    if (vehicleImage !== undefined && typeof vehicleImage !== "string") {
      return errorResponse(res, "Vehicle image must be a URL string", 400);
    }
    if (incomingVehicleImages === null || (incomingVehicleImages && (
      incomingVehicleImages.length > 4 ||
      incomingVehicleImages.some((url) => typeof url !== "string" || !url.startsWith("https://"))
    ))) {
      return errorResponse(res, "Vehicle photos must contain no more than 4 images", 400);
    }

    const basePhotoUrls = incomingVehicleImages ?? (vehicleImage ? [vehicleImage] : []);
    if (basePhotoUrls.length + (req.files || []).length > 4) {
      return errorResponse(res, "A maximum of 4 vehicle photos is allowed", 400);
    }
    uploadedAssets = await uploadVehiclePhotos(req.files || []);
    const uploadedPhotoUrls = uploadedAssets.map((asset) => asset.secure_url);
    const photoUrls = [...basePhotoUrls, ...uploadedPhotoUrls];
    if (photoUrls.length > 4) {
      await removeUploadedVehiclePhotoAssets(uploadedAssets);
      uploadedAssets = [];
      return errorResponse(res, "A maximum of 4 vehicle photos is allowed", 400);
    }

    const vehicle = await Vehicle.create({
      agency: agency._id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleModel: vehicleModel.trim(),
      vehicleType,
      loadCapacity: parsedCapacity,
      bodyType: bodyType || "open",
      vehicleImage: photoUrls[0] || "",
      vehicleImages: photoUrls
    });
    uploadedAssets = [];

    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(vehicle)) },
      "Vehicle added. Upload its registration and insurance documents for administrator review before assigning a driver.",
      201
    );
  } catch (error) {
    console.error("createAgencyVehicle error:", error);
    if (error.code === 11000) {
      await removeUploadedVehiclePhotoAssets(uploadedAssets);
      return errorResponse(res, "Vehicle number already registered", 409);
    }
    await removeUploadedVehiclePhotoAssets(uploadedAssets);
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError || error?.name === "ValidationError") {
      return errorResponse(res, "Invalid vehicle details", 400);
    }
    return errorResponse(res, "Failed to create vehicle", 500);
  }
};

export const updateAgencyVehicle = async (req, res) => {
  let uploadedAssets = [];
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }

    const vehicle = await Vehicle.findOne({ _id: id, agency: agency._id });
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found in your agency", 404);
    }

    const {
      vehicleModel,
      vehicleType,
      loadCapacity,
      bodyType,
      vehicleImage,
      vehicleImages,
      isActive
    } = req.body;
    const parsedCapacity = parseVehicleCapacity(loadCapacity);
    const incomingPhotoList = parseVehiclePhotoList(req.body.existingPhotos ?? vehicleImages);
    if (vehicleImage !== undefined && typeof vehicleImage !== "string") {
      return errorResponse(res, "Vehicle image must be a URL string", 400);
    }
    if (incomingPhotoList === null || (incomingPhotoList && (
      incomingPhotoList.length > 4 ||
      incomingPhotoList.some((url) => typeof url !== "string" || !url.startsWith("https://"))
    ))) {
      return errorResponse(res, "Vehicle photos must be a list of no more than 4 HTTPS image URLs", 400);
    }
    if (isActive === "true" || isActive === "false") {
      req.body.isActive = isActive === "true";
    }

    if (vehicleModel) vehicle.vehicleModel = vehicleModel.trim();
    if (vehicleType) vehicle.vehicleType = vehicleType;
    if (parsedCapacity) vehicle.loadCapacity = parsedCapacity;
    if (bodyType) vehicle.bodyType = bodyType;
    if (typeof req.body.isActive === "boolean") vehicle.isActive = req.body.isActive;

    const currentPhotoUrls = Array.isArray(vehicle.vehicleImages) && vehicle.vehicleImages.length
      ? vehicle.vehicleImages
      : (vehicle.vehicleImage ? [vehicle.vehicleImage] : []);
    let retainedPhotoUrls = incomingPhotoList ?? currentPhotoUrls;
    if (incomingPhotoList === undefined && vehicleImage !== undefined) {
      const replacement = vehicleImage.trim();
      retainedPhotoUrls = replacement
        ? [replacement, ...currentPhotoUrls.slice(1)]
        : [];
    }
    if (retainedPhotoUrls.some((url) => !currentPhotoUrls.includes(url))) {
      return errorResponse(res, "Only existing vehicle photos can be retained; upload new photos as image files", 400);
    }
    if (retainedPhotoUrls.length + (req.files || []).length > 4) {
      return errorResponse(res, "A maximum of 4 vehicle photos is allowed", 400);
    }

    uploadedAssets = await uploadVehiclePhotos(req.files || []);
    const photoUrls = [...retainedPhotoUrls, ...uploadedAssets.map((asset) => asset.secure_url)];
    if (photoUrls.length > 4) {
      await removeUploadedVehiclePhotoAssets(uploadedAssets);
      uploadedAssets = [];
      return errorResponse(res, "A maximum of 4 vehicle photos is allowed", 400);
    }
    vehicle.vehicleImages = photoUrls;
    vehicle.vehicleImage = photoUrls[0] || "";
    await vehicle.save();
    uploadedAssets = [];
    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(vehicle)) },
      "Agency vehicle updated successfully"
    );
  } catch (error) {
    console.error("updateAgencyVehicle error:", error);
    await removeUploadedVehiclePhotoAssets(uploadedAssets);
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError || error?.name === "ValidationError") {
      return errorResponse(res, "Invalid vehicle details", 400);
    }
    return errorResponse(res, "Failed to update agency vehicle", 500);
  }
};

export const assignVehicleDriver = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }
    if (agency.approvalStatus !== "approved" || !agency.isActive) {
      return errorResponse(res, "Only an active, approved agency may assign drivers", 403);
    }

    const { id } = req.params;
    const { driverId, unassign } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }

    const vehicle = await Vehicle.findOne({ _id: id });
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found", 404);
    }
    if (!vehicle.agency || String(vehicle.agency._id || vehicle.agency) !== String(agency._id)) {
      return errorResponse(res, "You are not authorized to assign drivers to vehicles of another agency", 403);
    }

    // Support unassigning driver
    if (unassign || driverId === null || driverId === "") {
      vehicle.driver = null;
      await vehicle.save();
      let populated = vehicle;
      if (typeof vehicle.populate === "function") {
        try {
          await vehicle.populate("driver", "fullName phone rating approvalStatus isActive documents.idProof.status documents.drivingLicense.status");
          populated = vehicle;
        } catch (_) {
          populated = vehicle;
        }
      }

      return successResponse(
        res,
        { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(populated || vehicle)) },
        "Driver unassigned from vehicle successfully"
      );
    }

    if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
      return errorResponse(res, "Valid driver ID is required", 400);
    }

    const driver = await Driver.findOne({ _id: driverId });
    if (!driver) {
      return errorResponse(res, "Driver not found", 404);
    }
    if (!await isActualDriverProfile(driver)) {
      return errorResponse(res, "Only genuine driver accounts may be assigned to vehicles", 403);
    }
    if (!driver.agency || String(driver.agency._id || driver.agency) !== String(agency._id)) {
      return errorResponse(res, "You are not authorized to assign drivers belonging to another agency", 403);
    }

    // Resolve association status reliably (handles legacy records)
    driver.agencyAssociation = resolveAgencyAssociation(driver);

    // Validate assignment conditions
    const assignCheck = checkDriverAssignableToVehicle(driver, vehicle, agency);
    if (!assignCheck.eligible) {
      return errorResponse(res, assignCheck.message, 403);
    }

    // Prevent duplicate assignment to this exact vehicle
    if (vehicle.driver && String(vehicle.driver._id || vehicle.driver) === String(driver._id)) {
      return errorResponse(res, "Driver is already assigned to this vehicle", 400);
    }

    // Prevent one driver from being assigned to conflicting vehicles
    const conflictingVehicle = await Vehicle.findOne({
      agency: agency._id,
      driver: driver._id,
      _id: { $ne: vehicle._id }
    });
    if (conflictingVehicle && String(conflictingVehicle._id) !== String(vehicle._id)) {
      return errorResponse(
        res,
        `Driver is already assigned to vehicle ${conflictingVehicle.vehicleNumber || 'another vehicle'}. Unassign that vehicle first.`,
        409
      );
    }

    vehicle.driver = driver._id;
    await vehicle.save();

    let populated = vehicle;
    if (typeof vehicle.populate === "function") {
      try {
        await vehicle.populate("driver", "fullName phone rating approvalStatus isActive documents.idProof.status documents.drivingLicense.status");
        populated = vehicle;
      } catch (_) {
        populated = vehicle;
      }
    }

    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(populated || vehicle)) },
      "Vehicle assigned to driver successfully"
    );
  } catch (error) {
    console.error("Assign vehicle driver error:", error);
    return errorResponse(res, "Failed to assign vehicle", 500);
  }
};

export const getAgencyBookings = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    // Find agency vehicles and drivers
    const actualDriverUserFilter = await getActualDriverUserFilter();
    const [vehicles, drivers] = await Promise.all([
      Vehicle.find({ agency: agency._id }).select("_id"),
      Driver.find({
        agency: agency._id,
        ...actualDriverUserFilter
      }).select("_id")
    ]);

    const vehicleIds = vehicles.map((v) => v._id);
    const driverIds = drivers.map((d) => d._id);

    const query = {
      $or: [
        { agency: agency._id },
        { vehicle: { $in: vehicleIds } },
        { driver: { $in: driverIds } }
      ]
    };
    const pagination = parsePagination(req.query, { defaultPage: 1, defaultLimit: 50, maxLimit: 100 });
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("customer", "name phone")
        .populate("driver", "fullName phone")
        .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity isActive isAvailable documents")
        .populate("assignmentHistory.actor", "name role")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      Booking.countDocuments(query)
    ]);

    return successResponse(
      res,
      {
        bookings,
        pagination: {
          total,
          returned: bookings.length,
          page: pagination.page,
          limit: pagination.limit,
          pages: Math.ceil(total / pagination.limit)
        }
      },
      "Agency bookings fetched"
    );
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency bookings", 500);
  }
};

export const assignAgencyBooking = async (req, res) => {
  let reservedVehicleId;
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) return errorResponse(res, "Agency not found", 404);
    if (agency.approvalStatus !== "approved" || !agency.isActive) {
      return errorResponse(res, "Only an active, approved agency may assign bookings", 403);
    }

    const { id } = req.params;
    const { driverId, vehicleId } = req.body;
    if (![id, driverId, vehicleId].every((value) => mongoose.Types.ObjectId.isValid(value))) {
      return errorResponse(res, "Valid booking, driver, and vehicle IDs are required", 400);
    }

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse(res, "Booking not found", 404);
    if (booking.bookingStatus !== "pending" || booking.driver) {
      return errorResponse(res, "Booking is not available for agency assignment", 409);
    }
    if (booking.agency && String(booking.agency) !== String(agency._id)) {
      return errorResponse(res, "Booking belongs to another agency", 403);
    }
    if (!booking.agency) {
      if (!booking.vehicle) {
        return errorResponse(res, "Booking is not routed to your agency", 403);
      }
      const selectedFleetVehicle = await Vehicle.findOne({
        _id: booking.vehicle,
        agency: agency._id
      });
      if (!selectedFleetVehicle) {
        return errorResponse(res, "Booking belongs to another agency", 403);
      }
    }

    const driver = await Driver.findOne({ _id: driverId, agency: agency._id });
    if (!driver || driver.agencyAssociation?.status !== "approved") {
      return errorResponse(res, "Driver must belong to this agency and have an approved agency association", 403);
    }
    if (!await isActualDriverProfile(driver)) {
      return errorResponse(res, "Only genuine driver accounts may be assigned to bookings", 403);
    }

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      agency: agency._id,
      driver: driver._id,
      isActive: true,
      isAvailable: true
    });
    const eligibility = checkDriverAssignableToVehicle(driver, vehicle, agency);
    if (!eligibility.eligible) return errorResponse(res, eligibility.message, 400);
    if (vehicle.vehicleType !== booking.vehicleType) {
      return errorResponse(res, "Vehicle type does not match the booking", 400);
    }

    const capacityKg = vehicle.loadCapacity?.unit === "ton"
      ? Number(vehicle.loadCapacity.value || 0) * 1000
      : Number(vehicle.loadCapacity?.value || 0);
    const requiredWeightKg = booking.weight?.unit === "ton"
      ? Number(booking.weight.value || 0) * 1000
      : Number(booking.weight?.value || 0);
    if (capacityKg < requiredWeightKg) return errorResponse(res, "Vehicle capacity is insufficient for this booking", 400);

    const reservedVehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicle._id, agency: agency._id, driver: driver._id, isActive: true, isAvailable: true },
      { $set: { isAvailable: false } },
      { new: true }
    );
    if (!reservedVehicle) return errorResponse(res, "Vehicle is no longer available", 409);
    reservedVehicleId = reservedVehicle._id;

    const assigned = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        bookingStatus: "pending",
        driver: null,
        $and: [
          { $or: [{ agency: agency._id }, { agency: null }] },
          { $or: [{ assignmentStatus: { $in: ["unassigned", "rejected"] } }, { assignmentStatus: { $exists: false } }] }
        ]
      },
      {
        $set: {
          agency: agency._id,
          driver: driver._id,
          vehicle: vehicle._id,
          assignmentStatus: "pending_acceptance",
          rejectedReason: ""
        },
        $push: {
          assignmentHistory: {
            action: "assigned",
            actor: req.user._id,
            actorRole: "agency",
            driver: driver._id,
            vehicle: vehicle._id
          }
        }
      },
      { new: true }
    );
    if (!assigned) {
      await Vehicle.findOneAndUpdate(
        { _id: reservedVehicle._id, driver: driver._id, isAvailable: false },
        { $set: { isAvailable: true } }
      );
      reservedVehicleId = null;
      return errorResponse(res, "Booking was assigned by another request or is no longer available", 409);
    }
    reservedVehicleId = null;

    await notifyDriver(driver.user, "New Booking Request", `Booking ${booking.bookingId} is awaiting your response.`, assigned._id);
    await notifyCustomer(assigned.customer, "Driver Assigned", `A driver has been assigned to booking ${booking.bookingId} and must accept it.`, assigned._id);
    emitToUser(agency.owner, "booking:assigned", {
      bookingId: assigned.bookingId,
      bookingStatus: assigned.bookingStatus,
      assignmentStatus: assigned.assignmentStatus,
      driverId: assigned.driver,
      vehicleId: assigned.vehicle,
      updatedAt: assigned.updatedAt
    });

    return successResponse(res, { booking: assigned }, "Booking assigned and awaiting driver acceptance");
  } catch (error) {
    if (reservedVehicleId) {
      try {
        await Vehicle.findOneAndUpdate(
          { _id: reservedVehicleId, isAvailable: false },
          { $set: { isAvailable: true } }
        );
      } catch (releaseError) {
        console.error("Failed to release vehicle after agency booking assignment error:", releaseError);
      }
    }
    console.error("Agency booking assignment error:", error);
    return errorResponse(res, "Failed to assign booking", 500);
  }
};

export const getAgencyJoiningRequests = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { status } = req.query;
    const actualDriverUserFilter = await getActualDriverUserFilter();
    const drivers = await Driver.find({
      agency: agency._id,
      ...actualDriverUserFilter
    })
      .populate("user", "name phone email profileImage createdAt")
      .populate("agencyAssociation.reviewedBy", "name role")
      .sort({ createdAt: -1 });

    const requests = drivers
      .map((driver) => {
        const d = driver.toObject();
        const association = resolveAgencyAssociation(d);
        return {
          id: d._id,
          fullName: d.fullName || d.user?.name || "",
          phone: d.phone || d.user?.phone || "",
          email: d.email || d.user?.email || "",
          createdAt: d.createdAt,
          registeredAt: d.createdAt,
          agencyAssociation: association,
          approvalStatus: d.approvalStatus,
          documents: {
            idProof: {
              status: d.documents?.idProof?.status || "not_uploaded"
            },
            drivingLicense: {
              status: d.documents?.drivingLicense?.status || "not_uploaded"
            }
          }
        };
      })
      .filter((reqItem) => {
        if (!status || status === "all") return true;
        return reqItem.agencyAssociation?.status === status;
      });

    return successResponse(res, { requests }, "Driver joining requests fetched");
  } catch (error) {
    console.error("Get joining requests error:", error);
    return errorResponse(res, "Failed to fetch driver joining requests", 500);
  }
};

export const acceptAgencyDriverRequest = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid driver request ID", 400);
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return errorResponse(res, "Driver request not found", 404);
    }

    if (!driver.agency || String(driver.agency) !== String(agency._id)) {
      return errorResponse(res, "You are not authorized to act on drivers registered with another agency", 403);
    }

    if (driver.agencyAssociation?.status === "approved") {
      return errorResponse(res, "Driver joining request has already been accepted", 400);
    }

    const now = new Date();
    driver.agencyAssociation = {
      status: "approved",
      rejectionReason: "",
      decidedAt: now,
      decisionAt: now,
      reviewedBy: req.user._id
    };

    // Agency acceptance only updates association status; does NOT approve KYC or final driver approval
    await driver.save();

    return successResponse(res, {
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        agencyAssociation: driver.agencyAssociation,
        approvalStatus: driver.approvalStatus
      }
    }, "Driver joining request accepted successfully");
  } catch (error) {
    console.error("Accept driver request error:", error);
    return errorResponse(res, "Failed to accept driver joining request", 500);
  }
};

export const rejectAgencyDriverRequest = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid driver request ID", 400);
    }

    const reason = (req.body?.reason || req.body?.rejectionReason || "").trim();
    if (!reason) {
      return errorResponse(res, "A rejection reason is required", 400);
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return errorResponse(res, "Driver request not found", 404);
    }

    if (!driver.agency || String(driver.agency) !== String(agency._id)) {
      return errorResponse(res, "You are not authorized to act on drivers registered with another agency", 403);
    }

    if (driver.agencyAssociation?.status === "rejected") {
      return errorResponse(res, "Driver joining request has already been rejected", 400);
    }

    const now = new Date();
    driver.agencyAssociation = {
      status: "rejected",
      rejectionReason: reason,
      decidedAt: now,
      decisionAt: now,
      reviewedBy: req.user._id
    };

    await driver.save();

    return successResponse(res, {
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        agencyAssociation: driver.agencyAssociation,
        approvalStatus: driver.approvalStatus
      }
    }, "Driver joining request rejected");
  } catch (error) {
    console.error("Reject driver request error:", error);
    return errorResponse(res, "Failed to reject driver joining request", 500);
  }
};

export const getAgencyStats = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const actualDriverUserFilter = await getActualDriverUserFilter();
    const allDrivers = await Driver.find({
      agency: agency._id,
      ...actualDriverUserFilter
    }).lean();
    const total = allDrivers.length;

    const resolvedDrivers = allDrivers.map((d) => ({
      ...d,
      agencyAssociation: resolveAgencyAssociation(d)
    }));

    const pendingAgency = resolvedDrivers.filter(
      (d) => d.agencyAssociation.status === "pending"
    ).length;

    const acceptedPendingSuperAdmin = resolvedDrivers.filter(
      (d) => d.agencyAssociation.status === "approved" && d.approvalStatus === "pending"
    ).length;

    const superAdminApprovedAndEligible = resolvedDrivers.filter(
      (d) => d.agencyAssociation.status === "approved" &&
             d.approvalStatus === "approved" &&
             d.isActive !== false &&
             d.documents?.idProof?.status === "approved" &&
             d.documents?.drivingLicense?.status === "approved"
    ).length;

    const rejectedOrSuspended = resolvedDrivers.filter(
      (d) => d.agencyAssociation.status === "rejected" ||
             d.approvalStatus === "rejected" ||
             d.approvalStatus === "suspended"
    ).length;

    return successResponse(res, {
      counts: {
        total,
        pendingAgency,
        acceptedPendingSuperAdmin,
        superAdminApprovedAndEligible,
        rejectedOrSuspended
      }
    }, "Agency driver stats fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency stats", 500);
  }
};
