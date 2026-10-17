import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { parsePagination } from "../utils/pagination.js";
import { hashPassword } from "../utils/password.js";

// Helper to retrieve current authenticated user's agency
const getAgencyForUser = async (userId) => {
  return await Agency.findOne({ owner: userId });
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
      .sort({ createdAt: -1 });

    const { generateSignedDocumentUrl, extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    const enhancedDrivers = drivers.map((d) => {
      const dObj = d.toObject();
      if (dObj.documents) {
        for (const [key, doc] of Object.entries(dObj.documents)) {
          if (doc && (doc.publicId || doc.url)) {
            let pubId = doc.publicId;
            let fmt = doc.format || "pdf";
            let resType = doc.resourceType || "image";
            if (!pubId && doc.url) {
              const ext = extractCloudinaryAssetInfo(doc.url);
              if (ext) { pubId = ext.publicId; fmt = ext.format; }
            }
            if (pubId) {
              dObj.documents[key].viewUrl = generateSignedDocumentUrl(pubId, fmt, 300, resType);
            } else {
              dObj.documents[key].viewUrl = doc.url;
            }
          }
        }
      }
      return dObj;
    });

    return successResponse(res, { drivers: enhancedDrivers }, "Agency drivers fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch agency drivers", 500);
  }
};

export const createAgencyDriver = async (req, res) => {
  try {
    const agency = await getAgencyForUser(req.user._id);
    if (!agency) {
      return errorResponse(res, "Agency not found", 404);
    }

    const { fullName, phone, email, password, address, emergencyContact, documents } = req.body;
    if (!fullName || !phone || !password) {
      return errorResponse(res, "Driver full name, phone number, and password are required", 400);
    }

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
      return errorResponse(res, "User with this phone number already exists", 409);
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      password: hashedPassword,
      role: "driver"
    });

    const cleanDocs = {};
    if (documents?.idProof?.url) {
      const url = String(documents.idProof.url).trim();
      if (url.startsWith("https://")) {
        cleanDocs.idProof = {
          url,
          publicId: documents.idProof.publicId || "",
          resourceType: documents.idProof.resourceType || "image",
          format: documents.idProof.format || (url.endsWith(".pdf") ? "pdf" : "jpg"),
          maskedNumber: documents.idProof.maskedNumber || "",
          status: "pending"
        };
      }
    }
    if (documents?.drivingLicense?.url) {
      const url = String(documents.drivingLicense.url).trim();
      if (url.startsWith("https://")) {
        cleanDocs.drivingLicense = {
          url,
          publicId: documents.drivingLicense.publicId || "",
          resourceType: documents.drivingLicense.resourceType || "image",
          format: documents.drivingLicense.format || (url.endsWith(".pdf") ? "pdf" : "jpg"),
          status: "pending"
        };
      }
    }

    const driver = await Driver.create({
      user: user._id,
      agency: agency._id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      address: address ? address.trim() : "",
      emergencyContact: emergencyContact || { name: "", phone: "" },
      documents: cleanDocs,
      approvalStatus: "pending" // Preserving Super Admin approval authority
    });

    return successResponse(res, { driver }, "Driver created by agency and pending Super Admin approval", 201);
  } catch (error) {
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
    const { documents } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid driver ID", 400);
    }

    // Agency isolation: verify driver belongs to this agency
    const driver = await Driver.findOne({ _id: id, agency: agency._id });
    if (!driver) {
      return errorResponse(res, "Driver not found in your agency", 404);
    }

    const { extractCloudinaryAssetInfo } = await import("../utils/documentSigner.js");

    if (documents?.idProof?.url) {
      const url = String(documents.idProof.url).trim();
      if (!url.startsWith("https://")) return errorResponse(res, "Aadhaar URL must be a valid secure HTTPS link", 400);
      let pubId = documents.idProof.publicId || "";
      let fmt = documents.idProof.format || "";
      if (!pubId) {
        const ext = extractCloudinaryAssetInfo(url);
        if (ext) { pubId = ext.publicId; fmt = ext.format; }
      }
      if (!fmt) fmt = url.endsWith(".pdf") ? "pdf" : "jpg";

      if (!driver.documents) driver.documents = {};
      driver.documents.idProof = {
        url,
        publicId: pubId,
        resourceType: documents.idProof.resourceType || "image",
        format: fmt,
        maskedNumber: documents.idProof.maskedNumber || driver.documents?.idProof?.maskedNumber || "",
        status: "pending"
      };
    }

    if (documents?.drivingLicense?.url) {
      const url = String(documents.drivingLicense.url).trim();
      if (!url.startsWith("https://")) return errorResponse(res, "Driving Licence URL must be a valid secure HTTPS link", 400);
      let pubId = documents.drivingLicense.publicId || "";
      let fmt = documents.drivingLicense.format || "";
      if (!pubId) {
        const ext = extractCloudinaryAssetInfo(url);
        if (ext) { pubId = ext.publicId; fmt = ext.format; }
      }
      if (!fmt) fmt = url.endsWith(".pdf") ? "pdf" : "jpg";

      if (!driver.documents) driver.documents = {};
      driver.documents.drivingLicense = {
        url,
        publicId: pubId,
        resourceType: documents.drivingLicense.resourceType || "image",
        format: fmt,
        status: "pending"
      };
    }

    if (typeof driver.markModified === "function") {
      driver.markModified("documents");
    }
    await driver.save();

    return successResponse(res, { driver }, "Driver documents updated successfully");
  } catch (error) {
    return errorResponse(res, error.message || "Failed to update driver documents", 500);
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
      .sort({ createdAt: -1 });

    return successResponse(res, { vehicles }, "Agency vehicles fetched");
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

    const {
      driverId,
      vehicleNumber,
      vehicleModel,
      vehicleType,
      loadCapacity,
      bodyType,
      vehicleImage,
      vehicleImages
    } = req.body;

    if (!driverId || !mongoose.Types.ObjectId.isValid(driverId)) {
      return errorResponse(res, "Valid driver ID is required", 400);
    }

    // Verify driver belongs to this agency
    const driver = await Driver.findOne({ _id: driverId, agency: agency._id });
    if (!driver) {
      return errorResponse(res, "Driver not found in your agency", 404);
    }

    if (!vehicleNumber || !vehicleModel || !vehicleType || !loadCapacity) {
      return errorResponse(res, "Required vehicle details missing", 400);
    }

    const vehicle = await Vehicle.create({
      driver: driver._id,
      agency: agency._id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleModel: vehicleModel.trim(),
      vehicleType,
      loadCapacity,
      bodyType: bodyType || "open",
      vehicleImage: vehicleImage || "",
      vehicleImages: vehicleImages || []
    });

    return successResponse(res, { vehicle }, "Agency vehicle added successfully", 201);
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
    return successResponse(res, { vehicle }, "Agency vehicle updated successfully");
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

    vehicle.driver = driver._id;
    await vehicle.save();

    return successResponse(res, { vehicle }, "Vehicle assigned to driver successfully");
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

