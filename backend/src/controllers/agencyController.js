import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { hashPassword } from "../utils/password.js";
import {
  isDriverEligibleForAssignment,
  isVehicleEligibleForBookings
} from "../utils/driverEligibility.js";
import { sanitizeVehicleDocumentResponse } from "../utils/vehicleDocumentResponse.js";
import { sanitizeDriverDocumentResponse } from "../utils/driverDocumentResponse.js";

// Helper to retrieve current authenticated user's agency
const getAgencyForUser = async (userId) => {
  return await Agency.findOne({ owner: userId });
};
const toPlainObject = (document) =>
  typeof document?.toObject === "function" ? document.toObject() : document;

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
  try {
    const { agencyName, phone, email, address, city, documents } = req.body;

    if (!agencyName || typeof agencyName !== "string" || !agencyName.trim()) {
      return errorResponse(res, "Agency name is required", 400);
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return errorResponse(res, "Phone number is required", 400);
    }

    const existing = await Agency.findOne({ $or: [{ owner: req.user._id }, { phone: phone.trim() }] });
    if (existing) {
      return errorResponse(res, "Agency with this owner or phone number already exists", 409);
    }

    const sanitizedDocs = {};
    if (documents?.ownerAadhaar?.url) {
      const url = String(documents.ownerAadhaar.url).trim();
      if (!url.startsWith("https://")) return errorResponse(res, "Owner Aadhaar URL must be a valid secure HTTPS link", 400);
      sanitizedDocs.ownerAadhaar = {
        url,
        publicId: documents.ownerAadhaar.publicId || "",
        resourceType: documents.ownerAadhaar.resourceType || "image",
        format: documents.ownerAadhaar.format || (url.endsWith(".pdf") ? "pdf" : "jpg"),
        maskedNumber: documents.ownerAadhaar.maskedNumber || "",
        status: "pending"
      };
    }
    if (documents?.businessRegistration?.url) {
      const url = String(documents.businessRegistration.url).trim();
      if (!url.startsWith("https://")) return errorResponse(res, "Business Registration URL must be a valid secure HTTPS link", 400);
      sanitizedDocs.businessRegistration = {
        url,
        publicId: documents.businessRegistration.publicId || "",
        resourceType: documents.businessRegistration.resourceType || "image",
        format: documents.businessRegistration.format || (url.endsWith(".pdf") ? "pdf" : "jpg"),
        status: "pending"
      };
    }
    if (documents?.taxId?.url) {
      const url = String(documents.taxId.url).trim();
      if (!url.startsWith("https://")) return errorResponse(res, "Tax ID URL must be a valid secure HTTPS link", 400);
      sanitizedDocs.taxId = {
        url,
        publicId: documents.taxId.publicId || "",
        resourceType: documents.taxId.resourceType || "image",
        format: documents.taxId.format || (url.endsWith(".pdf") ? "pdf" : "jpg"),
        status: "pending"
      };
    }

    const agency = await Agency.create({
      owner: req.user._id,
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      address: address ? address.trim() : "",
      city: city ? city.trim() : "",
      documents: sanitizedDocs
    });

    // Update user role to agency if not already admin
    if (req.user.role !== "admin") {
      await User.findByIdAndUpdate(req.user._id, { role: "agency" });
    }

    return successResponse(res, { agency }, "Agency registered successfully and pending approval", 201);
  } catch (error) {
    return errorResponse(res, "Failed to register agency", 500);
  }
};

export const getMyAgency = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const agencyObj = agency.toObject();
    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    if (agencyObj.documents) {
      for (const [key, doc] of Object.entries(agencyObj.documents)) {
        if (doc && (doc.publicId || doc.url)) {
          let pubId = doc.publicId;
          let fmt = doc.format || "pdf";
          let resType = doc.resourceType || "image";
          if (!pubId && doc.url) {
            const ext = extractCloudinaryAssetInfo(doc.url);
            if (ext) { pubId = ext.publicId; fmt = ext.format; }
          }
          if (pubId) {
            agencyObj.documents[key].viewUrl = generateSignedDocumentUrl(pubId, fmt, 300, resType);
          } else {
            agencyObj.documents[key].viewUrl = doc.url;
          }
        }
      }
    }

    return successResponse(res, { agency: agencyObj }, "Agency profile fetched");
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

    const { agencyName, address, city, documents } = req.body;
    const updates = {};
    if (agencyName) updates.agencyName = agencyName.trim();
    if (address !== undefined) updates.address = address.trim();
    if (city !== undefined) updates.city = city.trim();
    if (documents) updates.documents = documents;

    const updated = await Agency.findByIdAndUpdate(agency._id, { $set: updates }, { new: true });
    return successResponse(res, { agency: updated }, "Agency profile updated");
  } catch (error) {
    return errorResponse(res, "Failed to update agency profile", 500);
  }
};

// Agency-managed Drivers
export const getAgencyDrivers = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const drivers = await Driver.find({ agency: agency._id })
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
      dObj.assignedVehicle = vehicleByDriver.get(String(d._id)) || null;
      return sanitizeDriverDocumentResponse(dObj, { includeSignedUrls: true });
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

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
      return errorResponse(res, "User with this phone number already exists", 409);
    }

    const hashedPassword = await hashPassword(password);
    createdUser = await User.create({
      name: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      password: hashedPassword,
      role: "driver"
    });

    const driver = await Driver.create({
      user: createdUser._id,
      agency: agency._id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
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
      return errorResponse(res, "User with this phone number already exists", 409);
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
      .populate("driver", "fullName phone rating approvalStatus isActive")
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

export const createAgencyVehicle = async (req, res) => {
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

    if (!vehicleNumber || !vehicleModel || !vehicleType || !loadCapacity) {
      return errorResponse(res, "Required vehicle details missing", 400);
    }

    const vehicle = await Vehicle.create({
      agency: agency._id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleModel: vehicleModel.trim(),
      vehicleType,
      loadCapacity,
      bodyType: bodyType || "open",
      vehicleImage: vehicleImage || "",
      vehicleImages: vehicleImages || []
    });

    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(vehicle)) },
      "Vehicle added. Upload its registration and insurance documents for administrator review before assigning a driver.",
      201
    );
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, "Vehicle number already registered", 409);
    }
    return errorResponse(res, "Failed to create vehicle", 500);
  }
};

export const updateAgencyVehicle = async (req, res) => {
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

    if (vehicleModel) vehicle.vehicleModel = vehicleModel.trim();
    if (vehicleType) vehicle.vehicleType = vehicleType;
    if (loadCapacity) vehicle.loadCapacity = loadCapacity;
    if (bodyType) vehicle.bodyType = bodyType;
    if (vehicleImage !== undefined) vehicle.vehicleImage = vehicleImage;
    if (vehicleImages) vehicle.vehicleImages = vehicleImages;
    if (typeof isActive === "boolean") vehicle.isActive = isActive;

    await vehicle.save();
    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(vehicle)) },
      "Agency vehicle updated successfully"
    );
  } catch (error) {
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
    const { driverId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid vehicle ID", 400);
    }
    if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
      return errorResponse(res, "Valid driver ID is required", 400);
    }

    const vehicle = await Vehicle.findOne({ _id: id, agency: agency._id });
    if (!vehicle) {
      return errorResponse(res, "Vehicle not found in your agency", 404);
    }

    const driver = await Driver.findOne({ _id: driverId, agency: agency._id });
    if (!driver) {
      return errorResponse(res, "Driver not found in your agency", 404);
    }
    if (!isDriverEligibleForAssignment(driver)) {
      return errorResponse(
        res,
        "Driver must be active, approved, and have approved identity documents before assignment",
        403
      );
    }
    if (!isVehicleEligibleForBookings(vehicle)) {
      return errorResponse(
        res,
        "Vehicle registration and insurance must both be approved before assigning a driver",
        403
      );
    }

    vehicle.driver = driver._id;
    await vehicle.save();

    return successResponse(
      res,
      { vehicle: sanitizeVehicleDocumentResponse(toPlainObject(vehicle)) },
      "Vehicle assigned to driver successfully"
    );
  } catch (error) {
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
    const [vehicles, drivers] = await Promise.all([
      Vehicle.find({ agency: agency._id }).select("_id"),
      Driver.find({ agency: agency._id }).select("_id")
    ]);

    const vehicleIds = vehicles.map((v) => v._id);
    const driverIds = drivers.map((d) => d._id);

    const Booking = (await import("../models/Booking.js")).default;
    const bookings = await Booking.find({
      $or: [{ vehicle: { $in: vehicleIds } }, { driver: { $in: driverIds } }]
    })
      .populate("customer", "name phone")
      .populate("driver", "fullName phone")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType")
      .sort({ createdAt: -1 })
      .limit(50);

    return successResponse(res, { bookings }, "Agency bookings fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency bookings", 500);
  }
};
