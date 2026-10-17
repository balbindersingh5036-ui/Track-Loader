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

    const agency = await Agency.create({
      owner: req.user._id,
      agencyName: agencyName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      address: address ? address.trim() : "",
      city: city ? city.trim() : "",
      documents: documents || {}
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
    return successResponse(res, { agency }, "Agency profile fetched");
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

    return successResponse(res, { drivers }, "Agency drivers fetched");
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

    const driver = await Driver.create({
      user: user._id,
      agency: agency._id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : "",
      address: address ? address.trim() : "",
      emergencyContact: emergencyContact || { name: "", phone: "" },
      documents: documents || {},
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

    driver.documents = { ...driver.documents, ...documents };
    await driver.save();

    return successResponse(res, { driver }, "Driver documents updated successfully");
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

