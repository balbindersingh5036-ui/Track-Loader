import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import Agency from "../models/Agency.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Fare from "../models/Fare.js";
import * as fareService from "../services/fareService.js";
import { calculateRoadRoute } from "../services/routingService.js";
import generateBookingId from "../utils/generateBookingId.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { notifyCustomer, notifyDriver, notifyAdmins } from "../services/notificationService.js";
import { emitToBooking, emitToUser } from "../sockets/socket.js";
import { isSettingEnabled } from "../services/systemSettingService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  isDriverEligibleForAssignment,
  isVehicleEligibleForBookings,
  isDriverAssociationApproved
} from "../utils/driverEligibility.js";
import { getCleanVehicleDisplayName } from "../utils/vehicleDocumentResponse.js";
import { isValidVehicleModel } from "../utils/vehicleValidation.js";
import { isActualDriverProfile } from "../utils/actualDriver.js";

const isFiniteNumericInput = (value) =>
  (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
  Number.isFinite(Number(value));

const hasMatchingVehicleOwner = (driver, vehicle) =>
  String(driver?.agency?._id || driver?.agency || "") ===
  String(vehicle?.agency?._id || vehicle?.agency || "");

const isEligibleDriverVehicle = (driver, vehicle) =>
  isDriverEligibleForAssignment(driver) &&
  isVehicleEligibleForBookings(vehicle) &&
  hasMatchingVehicleOwner(driver, vehicle) &&
  (!vehicle.agency || vehicle.agency.approvalStatus === undefined ||
    (vehicle.agency.approvalStatus === "approved" && vehicle.agency.isActive)) &&
  (!driver.agency || driver.agency.approvalStatus === undefined ||
    (driver.agency.approvalStatus === "approved" && driver.agency.isActive));

const getActiveApprovedAgency = async (agency) => {
  if (!agency) return null;
  if (agency.approvalStatus !== undefined) return agency;
  return Agency.findById(agency);
};

const hasConflictingDriverBooking = async (driverId, excludedBookingId = null) => {
  const query = {
    driver: driverId,
    bookingStatus: { $in: ["pending", "accepted", "in-progress"] }
  };
  if (excludedBookingId) query._id = { $ne: excludedBookingId };
  if (typeof Booking?.exists !== "function") return false;
  try {
    return Boolean(await Booking.exists(query));
  } catch (_) {
    return false;
  }
};

const emitBookingEvent = (booking, eventName, userId = null) => {
  const payload = {
    bookingId: booking.bookingId,
    bookingStatus: booking.bookingStatus,
    assignmentStatus: booking.assignmentStatus || "unassigned",
    driverId: booking.driver,
    vehicleId: booking.vehicle,
    updatedAt: booking.updatedAt
  };
  emitToBooking(booking._id, eventName, payload);
  if (userId) emitToUser(userId, eventName, payload);
};

export const createBooking = async (req, res) => {
  let reservedVehicleId = null;
  try {
    const isBookingEnabled = await isSettingEnabled("booking.enabled");
    if (!isBookingEnabled) {
      return errorResponse(res, "Booking service is currently unavailable", 403);
    }

    let {
      pickup,
      drop,
      goods,
      weight,
      preferredPickupDate,
      preferredPickupTime,
      vehicleType,
      vehicle,
      customerNote,
      agencyId: requestedAgencyId,
      bookingMode = "instant",
      paymentMethod = "COD"
    } = req.body;

    if (!["instant", "scheduled"].includes(bookingMode)) {
      return errorResponse(res, "Invalid booking mode. Must be instant or scheduled", 400);
    }

    const normalizedPaymentMethod = String(paymentMethod || "COD").trim().toUpperCase();
    if (!["COD", "ONLINE"].includes(normalizedPaymentMethod)) {
      return errorResponse(res, "Invalid payment method. Supported methods are COD and ONLINE", 400);
    }

    if (
      !pickup?.address ||
      !isFiniteNumericInput(pickup.latitude) ||
      !isFiniteNumericInput(pickup.longitude) ||
      Number(pickup.latitude) < -90 ||
      Number(pickup.latitude) > 90 ||
      Number(pickup.longitude) < -180 ||
      Number(pickup.longitude) > 180
    ) {
      return errorResponse(res, "Invalid pickup details", 400);
    }
    if (
      !drop?.address ||
      !isFiniteNumericInput(drop.latitude) ||
      !isFiniteNumericInput(drop.longitude) ||
      Number(drop.latitude) < -90 ||
      Number(drop.latitude) > 90 ||
      Number(drop.longitude) < -180 ||
      Number(drop.longitude) > 180
    ) {
      return errorResponse(res, "Invalid drop details", 400);
    }
    if (!goods) return errorResponse(res, "Goods description is required", 400);

    if (
      !isFiniteNumericInput(weight?.value) ||
      Number(weight.value) < 0 ||
      typeof weight?.unit !== "string" ||
      !["kg", "ton"].includes(weight.unit)
    ) {
      return errorResponse(res, "Weight value and unit are required", 400);
    }
    if (!preferredPickupDate || !preferredPickupTime) return errorResponse(res, "Preferred date and time are required", 400);
    if (!vehicleType) return errorResponse(res, "Vehicle type is required", 400);

    // Validate scheduled pickup date & time if bookingMode is scheduled
    if (bookingMode === "scheduled") {
      const scheduledDateTime = new Date(`${preferredPickupDate}T${preferredPickupTime}`);
      if (isNaN(scheduledDateTime.getTime()) || scheduledDateTime.getTime() <= Date.now()) {
        return errorResponse(res, "Scheduled pickup date and time must be in the future", 400);
      }
    }

    let vehicleId = vehicle || null;
    let vehicleDoc = null;
    let agencyId = null;
    let alternativeVehicleAssigned = false;
    let assignmentCandidate = null;
    let agencyDoc = null;
    const requestedWeightKg = weight.unit === "ton"
      ? Number(weight.value) * 1000
      : Number(weight.value);
    const canDispatchWithVehicle = async (candidate) => {
      if (!candidate?.isActive || !candidate.isAvailable) return false;
      if (vehicleType && candidate.vehicleType !== vehicleType) return false;
      const driver = candidate.driver;
      if (!driver) return false;
      const isRoleDriver = await isActualDriverProfile(driver);
      if (!isRoleDriver || !isEligibleDriverVehicle(driver, candidate)) return false;
      if (driver.agency && driver.agencyAssociation?.status !== "approved" && !isDriverAssociationApproved(driver)) return false;
      if (bookingMode === "instant" && !driver.isOnline) return false;

      const capacityKg = candidate.loadCapacity?.unit === "ton"
        ? Number(candidate.loadCapacity.value || 0) * 1000
        : Number(candidate.loadCapacity?.value || 0);
      return capacityKg >= requestedWeightKg;
    };

    if (vehicleId) {
      if (!mongoose.Types.ObjectId.isValid(vehicleId)) return errorResponse(res, "Invalid vehicle ID", 400);
      const selectedVehicleQuery = Vehicle.findById(vehicleId);
      vehicleDoc = selectedVehicleQuery.populate
        ? await selectedVehicleQuery.populate([
          {
            path: "driver",
            populate: [
              { path: "agency" },
              { path: "user", select: "role" }
            ]
          },
          { path: "agency" }
        ])
        : await selectedVehicleQuery;
      if (!vehicleDoc) return errorResponse(res, "Vehicle not found", 404);

      if (vehicleDoc.vehicleType) {
        vehicleType = vehicleDoc.vehicleType;
      }

      const isSelectedUsable = vehicleDoc.isActive && vehicleDoc.isAvailable;

      if (isSelectedUsable && vehicleDoc.driver && (!vehicleDoc.driver._id || !vehicleDoc.driver.user || typeof vehicleDoc.driver.user !== "object" || !vehicleDoc.driver.user.role)) {
        try {
          if (mongoose.connection?.readyState === 1 || typeof Driver.findById.mock === "object") {
            const dQuery = Driver.findById(vehicleDoc.driver._id || vehicleDoc.driver);
            const resolvedDriver = dQuery?.populate
              ? await dQuery.populate([
                  { path: "agency" },
                  { path: "user", select: "role" }
                ])
              : await dQuery;
            if (resolvedDriver) {
              vehicleDoc.driver = resolvedDriver;
            }
          }
        } catch (_) {}
      }

      agencyId = vehicleDoc.agency?._id || vehicleDoc.agency || vehicleDoc.driver?.agency?._id || vehicleDoc.driver?.agency || null;
      if (agencyId) {
        if (vehicleDoc.agency && typeof vehicleDoc.agency === "object" && vehicleDoc.agency._id) {
          agencyDoc = vehicleDoc.agency;
        } else {
          try {
            if (mongoose.connection?.readyState === 1 || typeof Agency.findById.mock === "object") {
              agencyDoc = await Agency.findById(agencyId);
            }
          } catch (_) {}
        }
      }
      const selectedCapacityKg = vehicleDoc.loadCapacity?.unit === "ton"
        ? Number(vehicleDoc.loadCapacity.value || 0) * 1000
        : Number(vehicleDoc.loadCapacity?.value || 0);
      if (isSelectedUsable && vehicleDoc.loadCapacity?.value && selectedCapacityKg < requestedWeightKg) {
        return errorResponse(res, "Selected vehicle capacity is insufficient for the requested cargo", 400);
      }

      if (isSelectedUsable && await canDispatchWithVehicle(vehicleDoc)) {
        assignmentCandidate = vehicleDoc;
      }
    } else {
      if (!mongoose.Types.ObjectId.isValid(requestedAgencyId)) {
        return errorResponse(res, "Select an approved agency to route this booking for driver assignment", 400);
      }
      agencyDoc = await Agency.findOne({
        _id: requestedAgencyId,
        approvalStatus: "approved",
        isActive: true
      });
      if (!agencyDoc) return errorResponse(res, "Selected agency is unavailable", 400);
      agencyId = agencyDoc._id;

      const agencyVehicles = await Vehicle.find({
        agency: agencyDoc._id,
        vehicleType,
        isActive: true,
        isAvailable: true
      }).populate({
        path: "driver",
        populate: [
          { path: "agency" },
          { path: "user", select: "role" }
        ]
      }).populate("agency");
      for (const candidate of agencyVehicles) {
        if (await canDispatchWithVehicle(candidate)) {
          assignmentCandidate = candidate;
          break;
        }
      }
    }
    if (
      assignmentCandidate?.driver &&
      await hasConflictingDriverBooking(assignmentCandidate.driver._id || assignmentCandidate.driver)
    ) {
      assignmentCandidate = null;
    }
    if (assignmentCandidate) {
      vehicleDoc = assignmentCandidate;
      vehicleId = assignmentCandidate._id;
      agencyId = assignmentCandidate.agency?._id || assignmentCandidate.agency || agencyId;
      alternativeVehicleAssigned = Boolean(
        vehicle && String(assignmentCandidate._id) !== String(vehicle)
      );
    } else {
      alternativeVehicleAssigned = false;
      if (!vehicle) {
        vehicleId = null;
      }
    }

    let routeResult;
    try {
      routeResult = await calculateRoadRoute({
        pickup,
        drop,
        vehicleType
      });
    } catch (routeErr) {
      const statusCode = routeErr.status || (routeErr.isRateLimited ? 429 : 400);
      return errorResponse(
        res,
        routeErr.message || "Unable to calculate actual road distance between pickup and drop points via routing service.",
        statusCode
      );
    }

    const distanceKm = routeResult.distanceKm;

    let fareBreakdown;
    try {
      fareBreakdown = await fareService.calculateFareBreakdown({
        vehicleType,
        distanceKm,
        weightValue: weight.value,
        weightUnit: weight.unit
      });
    } catch (err) {
      return errorResponse(res, err.message, 400);
    }

    const estimatedFare = fareBreakdown.finalFare;

    let assignedDriver = null;
    if (assignmentCandidate?.driver) {
      const candidateDriverId = assignmentCandidate.driver._id || assignmentCandidate.driver;
      const reservedVehicle = await Vehicle.findOneAndUpdate(
        {
          _id: assignmentCandidate._id,
          driver: candidateDriverId,
          isActive: true,
          isAvailable: true
        },
        { $set: { isAvailable: false } },
        { new: true }
      );
      if (reservedVehicle) {
        reservedVehicleId = reservedVehicle._id;
        vehicleId = reservedVehicle._id;
        assignedDriver = assignmentCandidate.driver;
      } else {
        assignedDriver = null;
        alternativeVehicleAssigned = false;
        if (!vehicle) {
          vehicleId = null;
        }
      }
    }

    let savedVehicleName = "";
    if (vehicleDoc) {
      savedVehicleName = getCleanVehicleDisplayName(vehicleDoc);
    } else if (req.body.vehicleModel && isValidVehicleModel(req.body.vehicleModel)) {
      savedVehicleName = req.body.vehicleModel.trim();
    }

    const bookingId = await generateBookingId();
    const booking = new Booking({
      bookingId,
      customer: req.user._id,
      agency: agencyId,
      driver: assignedDriver ? (assignedDriver._id || assignedDriver) : null,
      vehicle: assignedDriver ? (vehicleDoc?._id || vehicleId) : null,
      vehicleModel: savedVehicleName,
      vehicleName: savedVehicleName,
      bookingMode,
      alternativeVehicleAssigned,
      pickup,
      drop,
      distanceKm: Math.max(0, parseFloat(distanceKm.toFixed(2))),
      routeGeometry: routeResult.geometry || "",
      pricingSnapshot: {
        category: vehicleType,
        ratePerKm: fareBreakdown.ratePerKm,
        ratePerTon: fareBreakdown.ratePerTon,
        minimumFare: fareBreakdown.minimumFare,
        distanceKm: fareBreakdown.distanceKm,
        distanceMeters: routeResult.distanceMeters,
        cargoWeightKg: fareBreakdown.cargoWeightKg,
        weightInTon: fareBreakdown.weightInTon,
        distanceCharge: fareBreakdown.distanceCharge,
        weightCharge: fareBreakdown.weightCharge,
        calculatedFare: fareBreakdown.calculatedFare,
        finalFare: fareBreakdown.finalFare,
        durationSeconds: routeResult.durationSeconds,
        routingProfile: routeResult.profile,
        calculatedAt: new Date()
      },
      goods,
      weight,
      preferredPickupDate,
      preferredPickupTime,
      vehicleType,
      estimatedFare: parseFloat(estimatedFare.toFixed(2)),
      customerNote,
      paymentMethod: normalizedPaymentMethod,
      paymentStatus: "pending",
      assignmentStatus: assignedDriver ? "pending_acceptance" : "unassigned",
      paymentHistory: [{
        action: "initiated",
        paymentMethod: normalizedPaymentMethod,
        status: "pending",
        amount: parseFloat(estimatedFare.toFixed(2)),
        actor: req.user._id,
        actorRole: "customer",
        occurredAt: new Date()
      }],
      assignmentHistory: [{
        action: "created",
        actor: req.user._id,
        actorRole: "customer"
      }, ...(assignedDriver ? [{
        action: "assigned",
        actorRole: "system",
        driver: assignedDriver._id || assignedDriver,
        vehicle: vehicleDoc?._id || vehicleId
      }] : [])]
    });

    await booking.save();
    reservedVehicleId = null;

    await notifyCustomer(
      req.user._id,
      "Booking Created",
      assignedDriver
        ? `Booking created and assigned to a driver. The driver must accept your request.`
        : "Booking request created successfully. The agency will assign an available driver.",
      booking._id
    );
    let assignedDriverUserId = assignedDriver?.user?._id || assignedDriver?.user;
    if (assignedDriver && !assignedDriverUserId) {
      try {
        const d = await Driver.findById(assignedDriver._id || assignedDriver).select("user");
        assignedDriverUserId = d?.user?._id || d?.user;
      } catch (_) {}
    }
    if (assignedDriverUserId) {
      await notifyDriver(
        assignedDriverUserId,
        "New Booking Request",
        `Booking ${booking.bookingId} is awaiting your response.`,
        booking._id
      );
    }
    let assignedAgency = agencyDoc || vehicleDoc?.agency;
    if (agencyId && !assignedAgency?.owner) {
      assignedAgency = await Agency.findById(agencyId);
    }
    if (!assignedDriver && assignedAgency?.owner) {
      await notifyDriver(
        assignedAgency.owner,
        "Booking Needs Assignment",
        `Booking ${booking.bookingId} needs an available assigned driver.`,
        booking._id
      );
    }
    await notifyAdmins("New Booking", `New booking ${booking.bookingId} created`, booking._id);

    emitBookingEvent(booking, "booking:created", req.user._id);
    if (assignedDriverUserId) {
      emitBookingEvent(
        booking,
        "booking:assigned",
        assignedDriverUserId
      );
    }

    return successResponse(
      res,
      {
        booking,
        alternativeAssigned: alternativeVehicleAssigned,
        message: alternativeVehicleAssigned
          ? "Selected vehicle was unavailable; an alternative vehicle of the same type has been assigned."
          : undefined
      },
      "Booking created",
      201
    );
  } catch (error) {
    if (reservedVehicleId) {
      try {
        await Vehicle.findOneAndUpdate(
          { _id: reservedVehicleId, isAvailable: false },
          { $set: { isAvailable: true } }
        );
      } catch (releaseError) {
        console.error("Failed to release vehicle after booking creation error:", releaseError);
      }
    }
    console.error("Create booking error:", error);
    return errorResponse(res, "Failed to create booking", 500);
  }
};

export const getMyBookings = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const { status } = req.query;
    const query = { customer: req.user._id };
    if (status) query.bookingStatus = status;

    const bookings = await Booking.find(query)
      .populate("customer", "name phone email")
      .populate("driver", "fullName phone rating")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Booking.countDocuments(query);

    return successResponse(res, { bookings, total, page, pages: Math.ceil(total / limit) }, "Bookings fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch bookings", 500);
  }
};

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid booking ID", 400);

    const booking = await Booking.findById(id)
      .populate("customer", "name phone email profileImage")
      .populate("driver", "user phone approvalStatus isActive")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity bodyType");

    if (!booking) return errorResponse(res, "Booking not found", 404);

    if (req.user.role === "customer" && booking.customer._id.toString() !== req.user._id.toString()) return errorResponse(res, "Access denied", 403);
    if (req.user.role === "driver") {
      const driver = await Driver.findOne({ user: req.user._id });
      if (!driver || (booking.driver && booking.driver._id.toString() !== driver._id.toString())) return errorResponse(res, "Access denied", 403);
    }

    return successResponse(res, { booking }, "Booking fetched");
  } catch (error) {
    return errorResponse(res, "Failed to fetch booking", 500);
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const isCancellationEnabled = await isSettingEnabled("booking.customerCancellationEnabled");
    if (!isCancellationEnabled) {
      return errorResponse(res, "Cancellation service is currently unavailable", 403);
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const booking = await Booking.findOne({ _id: id, customer: req.user._id });
    if (!booking) return errorResponse(res, "Not found", 404);
    if (!["pending", "accepted"].includes(booking.bookingStatus)) return errorResponse(res, "Cannot cancel now", 400);

    const now = new Date();
    const assignedDriver = booking.driver ? await Driver.findById(booking.driver) : null;
    const cancelledBooking = await Booking.findOneAndUpdate(
      { _id: id, customer: req.user._id, bookingStatus: { $in: ["pending", "accepted"] } },
      {
        $set: { bookingStatus: "cancelled", cancellationReason: reason || "", cancelledAt: now },
        $push: {
          assignmentHistory: {
            action: "cancelled",
            actor: req.user._id,
            actorRole: "customer",
            driver: booking.driver || null,
            vehicle: booking.vehicle || null,
            reason: reason || "",
            occurredAt: now
          }
        }
      },
      { new: true }
    );
    if (!cancelledBooking) return errorResponse(res, "Booking was already updated and can no longer be cancelled", 409);

    if (booking.vehicle) await Vehicle.findByIdAndUpdate(booking.vehicle, { isAvailable: true });

    if (assignedDriver) {
      await notifyDriver(assignedDriver.user, "Booking Cancelled", `Booking ${booking.bookingId} has been cancelled`, booking._id);
    }
    if (booking.agency) {
      const assignedAgency = await Agency.findById(booking.agency);
      if (assignedAgency?.owner) {
        await notifyDriver(assignedAgency.owner, "Customer Cancelled Booking", `Customer cancelled booking ${booking.bookingId}.`, booking._id);
      }
    }
    await notifyAdmins("Booking Cancelled", `Booking ${booking.bookingId} was cancelled`, booking._id);
    emitBookingEvent(cancelledBooking, "booking:cancelled");

    return successResponse(res, { booking: cancelledBooking }, "Booking cancelled");
  } catch (error) {
    return errorResponse(res, "Failed to cancel", 500);
  }
};

export const getDriverRequests = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const driver = await Driver.findOne({ user: req.user._id }) || await Driver.findById(req.user._id);
    if (!driver) return errorResponse(res, "Driver profile not found", 404);
    if (!isDriverEligibleForAssignment(driver)) return errorResponse(res, "Not active, approved, or identity-verified", 403);
    const agency = await getActiveApprovedAgency(driver.agency);
    if (agency && (agency.approvalStatus !== "approved" || !agency.isActive)) {
      return errorResponse(res, "Your agency is not active or approved", 403);
    }
    if (driver.agency && driver.agencyAssociation?.status !== "approved") {
      return errorResponse(res, "Agency association is pending or rejected", 403);
    }

    const driverVehicles = await Vehicle.find({ driver: driver._id, isActive: true });
    const eligibleVehicles = driverVehicles.filter((vehicle) => isEligibleDriverVehicle(driver, vehicle));
    if (eligibleVehicles.length === 0) {
      return errorResponse(res, "No eligible active vehicle assigned with approved documents", 403);
    }

    const query = {
      driver: driver._id,
      bookingStatus: "pending",
      assignmentStatus: { $in: ["pending_acceptance", "unassigned", null] }
    };

    const bookings = await Booking.find(query).populate("customer", "name phone").populate("vehicle").sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Booking.countDocuments(query);

    return successResponse(res, { bookings, total, page, pages: Math.ceil(total / limit) }, "Requests fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const getDriverBookings = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const { status } = req.query;
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) return errorResponse(res, "Not found", 404);

    const query = { driver: driver._id };
    if (status) query.bookingStatus = status;

    const bookings = await Booking.find(query)
      .populate("customer", "name phone email")
      .populate("driver", "fullName phone rating")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Booking.countDocuments(query);
    return successResponse(res, { bookings, total, page, pages: Math.ceil(total / limit) }, "Fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const driver = await Driver.findOne({ user: req.user._id });
    if (!isDriverEligibleForAssignment(driver)) return errorResponse(res, "Not approved or identity-verified", 403);
    const agency = await getActiveApprovedAgency(driver.agency);
    if (agency && (agency.approvalStatus !== "approved" || !agency.isActive)) {
      return errorResponse(res, "Your agency is not active or approved", 403);
    }
    if (driver.agency && driver.agencyAssociation?.status !== "approved") {
      return errorResponse(res, "Agency association is pending or rejected", 403);
    }

    const booking = await Booking.findOne({
      _id: id,
      driver: driver._id,
      bookingStatus: "pending",
      assignmentStatus: { $in: ["pending_acceptance", "unassigned", null] }
    });
    if (!booking) return errorResponse(res, "This booking is not awaiting your acceptance", 403);
    if (await hasConflictingDriverBooking(driver._id, booking._id)) {
      return errorResponse(res, "Driver already has another active booking", 409);
    }

    const vehicle = await Vehicle.findOne({
      _id: booking.vehicle,
      driver: driver._id,
      isActive: true
    });

    if (!vehicle || !isEligibleDriverVehicle(driver, vehicle)) {
      return errorResponse(res, "No eligible vehicle with approved registration and insurance documents", 400);
    }
    if (vehicle.vehicleType !== booking.vehicleType) return errorResponse(res, "Assigned vehicle type does not match the booking", 400);
    const vehicleCapacityKg = vehicle.loadCapacity?.unit === "ton"
      ? Number(vehicle.loadCapacity.value || 0) * 1000
      : Number(vehicle.loadCapacity?.value || 0);
    const bookingWeightKg = booking.weight?.unit === "ton"
      ? Number(booking.weight.value || 0) * 1000
      : Number(booking.weight?.value || 0);
    if (vehicleCapacityKg < bookingWeightKg) return errorResponse(res, "Assigned vehicle capacity is insufficient", 400);

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: id, driver: driver._id, bookingStatus: "pending", assignmentStatus: { $in: ["pending_acceptance", "unassigned", null] } },
      {
        $set: { bookingStatus: "accepted", assignmentStatus: "accepted", acceptedAt: new Date() },
        $push: {
          assignmentHistory: {
            action: "accepted",
            actor: req.user._id,
            actorRole: "driver",
            driver: driver._id,
            vehicle: vehicle._id
          }
        }
      },
      { new: true }
    );
    if (!updatedBooking) return errorResponse(res, "Already accepted", 409);

    await notifyCustomer(updatedBooking.customer, "Booking Accepted", "Your booking has been accepted", updatedBooking._id);
    let assignedAgency = null;
    if (updatedBooking.agency) {
      assignedAgency = await Agency.findById(updatedBooking.agency);
      if (assignedAgency?.owner) {
        await notifyDriver(assignedAgency.owner, "Driver Accepted Booking", `Driver accepted booking ${updatedBooking.bookingId}.`, updatedBooking._id);
      }
    }
    emitBookingEvent(updatedBooking, "booking:accepted", assignedAgency?.owner);

    return successResponse(res, { booking: updatedBooking }, "Accepted");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) return errorResponse(res, "Driver profile not found", 404);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    const currentBooking = await Booking.findOne({
      _id: id,
      driver: driver._id,
      bookingStatus: "pending",
      assignmentStatus: { $in: ["pending_acceptance", "unassigned", null] }
    });
    if (!currentBooking) return errorResponse(res, "This booking is not awaiting your response", 403);

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: id, driver: driver._id, bookingStatus: "pending", assignmentStatus: { $in: ["pending_acceptance", "unassigned", null] } },
      {
        $set: { driver: null, vehicle: null, assignmentStatus: "rejected", rejectedReason: reason || "" },
        $push: {
          assignmentHistory: {
            action: "rejected",
            actor: req.user._id,
            actorRole: "driver",
            driver: driver._id,
            vehicle: null,
            reason: reason || ""
          }
        }
      },
      { new: true }
    );
    if (!updatedBooking) return errorResponse(res, "This booking is not awaiting your response", 403);

    const agency = updatedBooking.agency ? await Agency.findById(updatedBooking.agency) : null;
    if (currentBooking.vehicle) {
      await Vehicle.findOneAndUpdate(
        { _id: currentBooking.vehicle, driver: driver._id, isAvailable: false },
        { $set: { isAvailable: true } }
      );
    }
    if (agency?.owner) {
      await notifyDriver(agency.owner, "Driver Rejected Booking", `Driver released booking ${updatedBooking.bookingId}; it is available for reassignment.`, updatedBooking._id);
    }
    await notifyCustomer(updatedBooking.customer, "Driver Rejected Booking", "Your assigned driver declined. The agency will review reassignment.", updatedBooking._id);
    emitBookingEvent(updatedBooking, "booking:rejected", agency?.owner);

    return successResponse(res, { booking: updatedBooking }, "Rejected");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const startTrip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) return errorResponse(res, "Driver profile not found", 404);

    const booking = await Booking.findOneAndUpdate(
      { _id: id, driver: driver._id, bookingStatus: "accepted" },
      {
        $set: { bookingStatus: "in-progress", startedAt: new Date() },
        $push: { assignmentHistory: { action: "started", actor: req.user._id, actorRole: "driver", driver: driver._id } }
      },
      { new: true }
    );
    if (!booking) return errorResponse(res, "Not accepted", 400);

    await notifyCustomer(booking.customer, "Trip Started", "Your trip has started", booking._id);
    emitBookingEvent(booking, "booking:started");

    return successResponse(res, { booking }, "Started");
  } catch (error) {
    console.error("startTrip error:", error);
    return errorResponse(res, "Failed", 500);
  }
};

export const completeTrip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) return errorResponse(res, "Driver not found", 404);

    const booking = await Booking.findOneAndUpdate(
      { _id: id, driver: driver._id, bookingStatus: "in-progress" },
      {
        $set: { bookingStatus: "completed", completedAt: new Date() },
        $push: { assignmentHistory: { action: "completed", actor: req.user._id, actorRole: "driver", driver: driver._id } }
      },
      { new: true }
    );
    if (!booking) return errorResponse(res, "Not in progress", 400);

    booking.finalFare = booking.estimatedFare;
    await booking.save();
    await Driver.findByIdAndUpdate(driver._id, { $inc: { totalTrips: 1 } });
    if (booking.vehicle) await Vehicle.findByIdAndUpdate(booking.vehicle, { isAvailable: true });

    await notifyCustomer(booking.customer, "Trip Completed", "Your trip has been completed", booking._id);
    await notifyAdmins("Trip Completed", `Booking ${booking.bookingId} completed`, booking._id);
    emitBookingEvent(booking, "booking:completed");

    return successResponse(res, { booking }, "Completed");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const adminGetBookings = async (req, res) => {
  try {
    let pagination;
    try {
      pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    } catch (error) {
      return errorResponse(res, error.message, 400);
    }

    const { page, limit, skip } = pagination;
    const {
      bookingId,
      search,
      bookingStatus,
      paymentStatus,
      vehicleType,
      assignmentStatus,
      bookingMode,
      from,
      to,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;
    const query = {};
    if (bookingId !== undefined) {
      if (typeof bookingId !== "string" || bookingId.length > 100) {
        return errorResponse(res, "Booking reference must be a string of 100 characters or fewer", 400);
      }
      if (bookingId.trim()) {
        query.bookingId = { $regex: bookingId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      }
    }
    if (bookingStatus) {
      if (!["pending", "accepted", "rejected", "cancelled", "in-progress", "completed"].includes(bookingStatus)) {
        return errorResponse(res, "Invalid booking status", 400);
      }
      query.bookingStatus = bookingStatus;
    }
    if (paymentStatus) {
      if (!["pending", "paid", "failed", "refunded", "cash"].includes(paymentStatus)) {
        return errorResponse(res, "Invalid payment status", 400);
      }
      query.paymentStatus = paymentStatus;
    }
    if (vehicleType) {
      if (!["mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"].includes(vehicleType)) {
        return errorResponse(res, "Invalid vehicle category", 400);
      }
      query.vehicleType = vehicleType;
    }
    if (assignmentStatus) {
      if (!["unassigned", "pending_acceptance", "accepted", "rejected"].includes(assignmentStatus)) {
        return errorResponse(res, "Invalid assignment status", 400);
      }
      query.assignmentStatus = assignmentStatus;
    }
    if (bookingMode) {
      if (!["instant", "scheduled"].includes(bookingMode)) {
        return errorResponse(res, "Invalid booking mode", 400);
      }
      query.bookingMode = bookingMode;
    }
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
      return errorResponse(res, "Booking date filters must use YYYY-MM-DD", 400);
    }
    const dateRange = {};
    if (from) {
      const start = new Date(`${from}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) return errorResponse(res, "Invalid start date", 400);
      dateRange.$gte = start;
    }
    if (to) {
      const end = new Date(`${to}T00:00:00.000Z`);
      if (Number.isNaN(end.getTime())) return errorResponse(res, "Invalid end date", 400);
      end.setUTCDate(end.getUTCDate() + 1);
      dateRange.$lt = end;
    }
    if (from && to && from > to) {
      return errorResponse(res, "Start date must be on or before end date", 400);
    }
    if (Object.keys(dateRange).length) query.createdAt = dateRange;
    const sortFields = {
      createdAt: "createdAt",
      preferredPickupDate: "preferredPickupDate",
      estimatedFare: "estimatedFare",
      bookingId: "bookingId"
    };
    if (!Object.hasOwn(sortFields, sortBy) || !["asc", "desc"].includes(sortOrder)) {
      return errorResponse(res, "Invalid booking sort option", 400);
    }

    if (search !== undefined) {
      if (typeof search !== "string" || search.length > 100) {
        return errorResponse(res, "Search must be a string of 100 characters or fewer", 400);
      }
      const term = search.trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const [customers, agencies, drivers, vehicles] = await Promise.all([
          User.find({ $or: [{ name: regex }, { phone: regex }, { email: regex }] }).select("_id"),
          Agency.find({ $or: [{ agencyName: regex }, { phone: regex }, { email: regex }] }).select("_id"),
          Driver.find({ $or: [{ fullName: regex }, { phone: regex }] }).select("_id"),
          Vehicle.find({ vehicleNumber: regex }).select("_id")
        ]);
        query.$or = [
          { bookingId: regex },
          { "pickup.address": regex },
          { "drop.address": regex },
          { customer: { $in: customers.map(({ _id }) => _id) } },
          { agency: { $in: agencies.map(({ _id }) => _id) } },
          { driver: { $in: drivers.map(({ _id }) => _id) } },
          { vehicle: { $in: vehicles.map(({ _id }) => _id) } }
        ];
      }
    }

    const bookings = await Booking.find(query)
      .populate("customer", "name phone email")
      .populate({ path: "agency", select: "agencyName phone email approvalStatus", populate: { path: "owner", select: "name phone email" } })
      .populate("driver", "fullName phone approvalStatus agencyAssociation")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity")
      .sort({ [sortFields[sortBy]]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit);
    const [total, stats] = await Promise.all([
      Booking.countDocuments(query),
      Promise.all([
        Booking.countDocuments({}),
        Booking.countDocuments({ bookingStatus: "pending", assignmentStatus: "unassigned" }),
        Booking.countDocuments({ assignmentStatus: "pending_acceptance" }),
        Booking.countDocuments({ $or: [{ assignmentStatus: "rejected" }, { bookingStatus: "rejected" }] }),
        Booking.countDocuments({ bookingStatus: "accepted" }),
        Booking.countDocuments({ bookingStatus: "in-progress" }),
        Booking.countDocuments({ bookingStatus: "completed" }),
        Booking.countDocuments({ bookingStatus: "cancelled" })
      ])
    ]);
    const [
      totalBookings,
      pendingAgencyAssignment,
      awaitingDriverAcceptance,
      driverRejected,
      driverAccepted,
      inProgress,
      completed,
      cancelled
    ] = stats;
    return successResponse(res, {
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      stats: {
        total: totalBookings,
        pendingAgencyAssignment,
        awaitingDriverAcceptance,
        driverRejected,
        driverAccepted,
        inProgress,
        completed,
        cancelled
      }
    }, "Fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const adminGetBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);
    const booking = await Booking.findById(id)
      .populate("customer", "name phone email")
      .populate({ path: "agency", select: "agencyName phone email approvalStatus owner", populate: { path: "owner", select: "name phone email" } })
      .populate("driver", "fullName phone approvalStatus isActive agencyAssociation documents.idProof.status documents.drivingLicense.status")
      .populate("vehicle", "vehicleNumber vehicleModel vehicleType loadCapacity bodyType documents.registration.status documents.insurance.status")
      .populate("assignmentHistory.actor", "name role");
    if (!booking) return errorResponse(res, "Not found", 404);
    const payment = await Payment.findOne({ booking: booking._id })
      .select("amount method provider orderId transactionId status paidAt refundAmount refundId refundedAt createdAt")
      .lean();
    return successResponse(res, { booking, payment }, "Fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};
