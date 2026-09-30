import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import Fare from "../models/Fare.js";
import * as fareService from "../services/fareService.js";
import generateBookingId from "../utils/generateBookingId.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { notifyCustomer, notifyDriver, notifyAdmins } from "../services/notificationService.js";
import { emitToBooking } from "../sockets/socket.js";
import { isSettingEnabled } from "../services/systemSettingService.js";
import { parsePagination } from "../utils/pagination.js";

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); 
};

const isFiniteNumericInput = (value) =>
  (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
  Number.isFinite(Number(value));

const emitBookingEvent = (booking, eventName) => {
  emitToBooking(booking._id, eventName, {
    bookingId: booking.bookingId,
    bookingStatus: booking.bookingStatus,
    driverId: booking.driver,
    vehicleId: booking.vehicle,
    updatedAt: booking.updatedAt
  });
};

export const createBooking = async (req, res) => {
  try {
    const isBookingEnabled = await isSettingEnabled("booking.enabled");
    if (!isBookingEnabled) {
      return errorResponse(res, "Booking service is currently unavailable", 403);
    }

    const { pickup, drop, goods, weight, preferredPickupDate, preferredPickupTime, vehicleType, vehicle, customerNote } = req.body;

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

    let vehicleId = vehicle;
    if (vehicleId) {
      if (!mongoose.Types.ObjectId.isValid(vehicleId)) return errorResponse(res, "Invalid vehicle ID", 400);
      const vehicleDoc = await Vehicle.findById(vehicleId);
      if (!vehicleDoc) return errorResponse(res, "Vehicle not found", 404);
      if (!vehicleDoc.isActive || !vehicleDoc.isAvailable || vehicleDoc.vehicleType !== vehicleType) {
        return errorResponse(res, "Vehicle not available or type mismatch", 400);
      }
    }

    const distanceKm = calculateDistance(pickup.latitude, pickup.longitude, drop.latitude, drop.longitude);
    
    let estimatedFare;
    try {
      estimatedFare = await fareService.calculateEstimatedFare({
        vehicleType,
        distanceKm,
        weightValue: weight.value,
        weightUnit: weight.unit
      });
    } catch (err) {
      return errorResponse(res, err.message, 400);
    }

    const bookingId = await generateBookingId();
    const booking = new Booking({
      bookingId, customer: req.user._id, vehicle: vehicleId || null,
      pickup, drop, distanceKm: Math.max(0, parseFloat(distanceKm.toFixed(2))),
      goods, weight, preferredPickupDate, preferredPickupTime, vehicleType,
      estimatedFare: parseFloat(estimatedFare.toFixed(2)), customerNote
    });

    await booking.save();

    await notifyCustomer(req.user._id, "Booking Created", "Booking request created successfully", booking._id);
    await notifyAdmins("New Booking", `New booking ${booking.bookingId} created`, booking._id);
    emitBookingEvent(booking, "booking:created");

    return successResponse(res, { booking }, "Booking created", 201);
  } catch (error) {
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

    const bookings = await Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
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
      .populate("driver", "user phone isApproved isActive")
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

    booking.bookingStatus = "cancelled";
    booking.cancellationReason = reason || "";
    booking.cancelledAt = new Date();

    if (booking.vehicle) await Vehicle.findByIdAndUpdate(booking.vehicle, { isAvailable: true });
    await booking.save();

    if (booking.driver) {
      const driver = await Driver.findById(booking.driver);
      if (driver) await notifyDriver(driver.user, "Booking Cancelled", `Booking ${booking.bookingId} has been cancelled`, booking._id);
    }
    await notifyAdmins("Booking Cancelled", `Booking ${booking.bookingId} was cancelled`, booking._id);
    emitBookingEvent(booking, "booking:cancelled");

    return successResponse(res, { booking }, "Booking cancelled");
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
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver || !driver.isApproved || !driver.isActive) return errorResponse(res, "Not active/approved", 403);

    const driverVehicles = await Vehicle.find({ driver: driver._id, isActive: true, isAvailable: true });
    const vehicleTypes = driverVehicles.map(v => v.vehicleType);

    const query = {
      bookingStatus: "pending",
      $or: [{ driver: null, vehicleType: { $in: vehicleTypes } }, { driver: driver._id }]
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

    const bookings = await Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
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
    if (!driver || !driver.isApproved || !driver.isActive) return errorResponse(res, "Not approved", 403);

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse(res, "Not found", 404);
    if (booking.bookingStatus !== "pending") return errorResponse(res, "Not pending", 400);

    let vehicle = booking.vehicle 
      ? await Vehicle.findOne({ _id: booking.vehicle, driver: driver._id, isAvailable: true, isActive: true })
      : await Vehicle.findOne({ driver: driver._id, vehicleType: booking.vehicleType, isAvailable: true, isActive: true });

    if (!vehicle) return errorResponse(res, "No vehicle available", 400);

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: id, bookingStatus: "pending" },
      { $set: { driver: driver._id, vehicle: vehicle._id, bookingStatus: "accepted", acceptedAt: new Date() } },
      { new: true }
    );
    if (!updatedBooking) return errorResponse(res, "Already accepted", 409);

    await Vehicle.findByIdAndUpdate(vehicle._id, { isAvailable: false });

    await notifyCustomer(updatedBooking.customer, "Booking Accepted", "Your booking has been accepted", updatedBooking._id);
    emitBookingEvent(updatedBooking, "booking:accepted");

    return successResponse(res, { booking: updatedBooking }, "Accepted");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: id, bookingStatus: "pending" },
      { $set: { bookingStatus: "rejected", rejectedReason: reason || "" } },
      { new: true }
    );
    if (!updatedBooking) return errorResponse(res, "Not pending", 400);

    await notifyCustomer(updatedBooking.customer, "Booking Rejected", "Your booking request was rejected", updatedBooking._id);
    await notifyAdmins("Booking Rejected", `Driver rejected booking ${updatedBooking.bookingId}`, updatedBooking._id);
    emitBookingEvent(updatedBooking, "booking:rejected");

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
      { $set: { bookingStatus: "in-progress", startedAt: new Date() } },
      { new: true }
    );
    if (!booking) return errorResponse(res, "Not accepted", 400);

    await notifyCustomer(booking.customer, "Trip Started", "Your trip has started", booking._id);
    emitBookingEvent(booking, "booking:started");

    return successResponse(res, { booking }, "Started");
  } catch (error) {
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
      { $set: { bookingStatus: "completed", completedAt: new Date(), finalFare: "$estimatedFare" } },
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
    const { bookingId, bookingStatus, paymentStatus, vehicleType } = req.query;
    const query = {};
    if (bookingId) query.bookingId = { $regex: bookingId, $options: "i" };
    if (bookingStatus) query.bookingStatus = bookingStatus;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (vehicleType) query.vehicleType = vehicleType;

    const bookings = await Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Booking.countDocuments(query);
    return successResponse(res, { bookings, total, page, pages: Math.ceil(total / limit) }, "Fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const adminGetBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);
    const booking = await Booking.findById(id).populate("customer", "-password").populate("driver").populate("vehicle");
    if (!booking) return errorResponse(res, "Not found", 404);
    return successResponse(res, { booking }, "Fetched");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const adminUpdateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, "Invalid ID", 400);
    
    const validStatuses = ["pending", "accepted", "rejected", "cancelled", "in-progress", "completed"];
    if (!validStatuses.includes(status)) return errorResponse(res, "Invalid status", 400);

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse(res, "Not found", 404);
    if (booking.bookingStatus === "completed" || booking.bookingStatus === "cancelled") return errorResponse(res, "Cannot change completed/cancelled", 400);

    booking.bookingStatus = status;
    if (status === "accepted" && !booking.acceptedAt) booking.acceptedAt = new Date();
    if (status === "in-progress" && !booking.startedAt) booking.startedAt = new Date();
    if (status === "completed" && !booking.completedAt) {
      booking.completedAt = new Date();
      if (booking.driver) await Driver.findByIdAndUpdate(booking.driver, { $inc: { totalTrips: 1 } });
      if (booking.vehicle) await Vehicle.findByIdAndUpdate(booking.vehicle, { isAvailable: true });
    }
    if (status === "cancelled" && !booking.cancelledAt) {
      booking.cancelledAt = new Date();
      if (booking.vehicle) await Vehicle.findByIdAndUpdate(booking.vehicle, { isAvailable: true });
    }

    await booking.save();

    await notifyCustomer(booking.customer, "Status Updated", `Your booking status is now ${status}`, booking._id);
    if (booking.driver) {
      const driver = await Driver.findById(booking.driver);
      if (driver) await notifyDriver(driver.user, "Status Updated", `Booking ${booking.bookingId} status is now ${status}`, booking._id);
    }
    emitBookingEvent(booking, `booking:${status}`);

    return successResponse(res, { booking }, "Updated");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};

export const adminAssignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(driverId)) return errorResponse(res, "Invalid ID", 400);

    const booking = await Booking.findById(id);
    if (!booking) return errorResponse(res, "Not found", 404);
    if (booking.bookingStatus === "completed" || booking.bookingStatus === "cancelled") return errorResponse(res, "Cannot assign", 400);

    const driver = await Driver.findById(driverId);
    if (!driver || !driver.isApproved || !driver.isActive) return errorResponse(res, "Driver unavailable", 400);

    let vehicle = booking.vehicle 
      ? await Vehicle.findOne({ _id: booking.vehicle, driver: driver._id, isAvailable: true, isActive: true })
      : await Vehicle.findOne({ driver: driver._id, vehicleType: booking.vehicleType, isAvailable: true, isActive: true });

    if (!vehicle) return errorResponse(res, "Driver has no vehicle", 400);

    booking.driver = driver._id;
    booking.vehicle = vehicle._id;
    await booking.save();

    await notifyCustomer(booking.customer, "Driver Assigned", "Driver assigned to your booking", booking._id);
    await notifyDriver(driver.user, "New Booking", "New booking assigned", booking._id);
    emitBookingEvent(booking, "booking:assigned");

    return successResponse(res, { booking }, "Assigned");
  } catch (error) {
    return errorResponse(res, "Failed", 500);
  }
};
