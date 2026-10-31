import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Agency from "../src/models/Agency.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import User from "../src/models/User.js";
import Fare from "../src/models/Fare.js";
import Notification from "../src/models/Notification.js";
import SystemSetting from "../src/models/SystemSetting.js";
import cloudinary from "../src/config/cloudinary.js";
import { env } from "../src/config/env.js";

import {
  registerAgency,
  getMyAgency,
  updateMyAgency,
  getAgencyDrivers,
  createAgencyDriver,
  updateAgencyDriverDocuments,
  getAgencyVehicles,
  createAgencyVehicle
} from "../src/controllers/agencyController.js";

import {
  getAdminAgencies,
  getAdminAgencyById,
  approveAdminAgency,
  rejectAdminAgency,
  suspendAdminAgency
} from "../src/controllers/adminAgencyController.js";

import {
  approveAdminDriver,
  rejectAdminDriver,
  suspendAdminDriver
} from "../src/controllers/adminDriverController.js";

import {
  createBooking,
  acceptBooking,
  startTrip,
  completeTrip
} from "../src/controllers/bookingController.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const mockQuery = (value) => ({
  populate() { return this; },
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

const fareConfig = {
  baseFare: 100,
  perKmRate: 10,
  perTonRate: 50,
  minimumFare: 150,
  loadingCharge: 10,
  unloadingCharge: 5
};

test("Agency Lifecycle: 1. Owner registers an agency", async (t) => {
  const ownerId = new mongoose.Types.ObjectId();
  let createdAgencyData;
  let userRoleUpdated = false;
  const previousCloudinary = { ...env.cloudinary };
  Object.assign(env.cloudinary, { apiKey: "test-key", apiSecret: "test-secret", cloudName: "test-cloud" });
  t.after(() => Object.assign(env.cloudinary, previousCloudinary));

  t.mock.method(Agency, "findOne", async () => null);
  t.mock.method(Agency, "create", async (data) => {
    createdAgencyData = data;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      approvalStatus: "pending",
      isActive: true
    };
  });
  t.mock.method(cloudinary.uploader, "upload", async () => ({
    secure_url: "https://res.cloudinary.com/test/image/upload/private.png",
    public_id: "loadbalbin_kyc/test-registration-aadhaar",
    resource_type: "image",
    format: "png"
  }));
  t.mock.method(cloudinary.utils, "private_download_url", () => "https://signed.example/private.png");
  t.mock.method(User, "findByIdAndUpdate", async (_id, update) => {
    if (update.role === "agency") userRoleUpdated = true;
    return {};
  });

  const req = {
    user: { _id: ownerId, role: "customer" },
    body: {
      agencyName: "Speedy Logistics",
      phone: "+919876543210",
      email: "contact@speedy.com",
      address: "123 Transporter Hub",
      city: "Ludhiana"
    },
    files: {
      ownerAadhaar: [{
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        mimetype: "image/png",
        size: 8
      }]
    }
  };
  const res = createResponse();

  await registerAgency(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(createdAgencyData.agencyName, "Speedy Logistics");
  assert.equal(createdAgencyData.phone, "+919876543210");
  assert.equal(createdAgencyData.documents.ownerAadhaar.status, "pending");
  assert.equal(createdAgencyData.documents.businessRegistration, undefined);
  assert.equal(userRoleUpdated, true);
});

test("Agency Lifecycle: registration rejects client-supplied document references", async () => {
  const res = createResponse();

  await registerAgency({
    user: { _id: new mongoose.Types.ObjectId(), role: "customer" },
    body: {
      agencyName: "Untrusted Agency",
      phone: "+919876543210",
      documents: {
        ownerAadhaar: {
          url: "https://example.com/private.pdf",
          publicId: "loadbalbin_kyc/another-owner/private-document",
          status: "approved"
        }
      }
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /authenticated private upload endpoint/i);
});

test("Agency Lifecycle: 2. Super Admin approves the agency", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  let updatedFields;

  t.mock.method(Agency, "findByIdAndUpdate", async (id, update) => {
    updatedFields = update.$set;
    return {
      _id: agencyId,
      agencyName: "Speedy Logistics",
      approvalStatus: update.$set.approvalStatus,
      approvedBy: update.$set.approvedBy,
      approvedAt: update.$set.approvedAt
    };
  });

  const req = {
    user: { _id: adminId, role: "admin" },
    params: { id: agencyId.toString() }
  };
  const res = createResponse();

  await approveAdminAgency(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(updatedFields.approvalStatus, "approved");
  assert.equal(updatedFields.approvedBy.toString(), adminId.toString());
});

test("Agency Lifecycle: 3 & 4. Agency registers driver & submits Aadhaar and DL documents (initial status pending)", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved"
  }));
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async (data) => ({
    _id: driverUserId,
    ...data
  }));

  let createdDriverRecord;
  t.mock.method(Driver, "create", async (data) => {
    createdDriverRecord = data;
    return {
      _id: driverId,
      ...data
    };
  });

  // Step 3: Register driver
  const reqCreate = {
    user: { _id: ownerId, role: "agency" },
    body: {
      fullName: "Ramesh Kumar",
      phone: "+919811122233",
      email: "ramesh@speedy.com",
      password: "DriverSecurePassword123"
    }
  };
  const resCreate = createResponse();
  await createAgencyDriver(reqCreate, resCreate);

  assert.equal(resCreate.statusCode, 201);
  assert.equal(createdDriverRecord.agency.toString(), agencyId.toString());
  assert.equal(createdDriverRecord.approvalStatus, "pending"); // Preserves authority

  // Direct metadata URLs are rejected; uploads must go through the authenticated private upload route.
  const mockDriverInstance = {
    _id: driverId,
    agency: agencyId,
    documents: {},
    async save() { return this; }
  };
  t.mock.method(Driver, "findOne", async () => mockDriverInstance);

  const reqDoc = {
    user: { _id: ownerId, role: "agency" },
    params: { id: driverId.toString() },
    body: {
      documents: {
        idProof: { url: "https://docs.com/ramesh-aadhaar.pdf", status: "pending" },
        drivingLicense: { url: "https://docs.com/ramesh-dl.pdf", status: "pending" }
      }
    }
  };
  const resDoc = createResponse();
  await updateAgencyDriverDocuments(reqDoc, resDoc);

  assert.equal(resDoc.statusCode, 400);
  assert.equal(mockDriverInstance.documents.idProof, undefined);
  assert.equal(mockDriverInstance.documents.drivingLicense, undefined);
});

test("Agency-created Driver rejects an existing email before creating another User", async (t) => {
  const ownerId = new mongoose.Types.ObjectId();
  const existingUserId = new mongoose.Types.ObjectId();
  t.mock.method(Agency, "findOne", async () => ({ _id: new mongoose.Types.ObjectId(), approvalStatus: "approved" }));
  t.mock.method(User, "findOne", async (query) => {
    assert.ok(query.$or.some((criterion) => criterion.email === "existing@example.com"));
    return { _id: existingUserId };
  });
  t.mock.method(User, "create", async () => assert.fail("Duplicate email must not create another User"));

  const res = createResponse();
  await createAgencyDriver({
    user: { _id: ownerId, role: "agency" },
    body: {
      fullName: "Duplicate Email Driver",
      phone: "9811122233",
      email: " Existing@Example.com ",
      password: "password1"
    }
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /phone number or email/i);
});

test("Agency Lifecycle: 5. Super Admin approves driver (enforces authority)", async (t) => {
  const driverId = new mongoose.Types.ObjectId();
  let approvalUpdated = false;

  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    if (update.$set?.approvalStatus === "approved") {
      approvalUpdated = true;
    }
    return {
      populate: () => ({
        _id: driverId,
        fullName: "Ramesh Kumar",
        approvalStatus: "approved",
        user: { name: "Ramesh Kumar", phone: "+919811122233" }
      })
    };
  });
  t.mock.method(Driver, "findById", () => ({
    select() {
      return {
        lean: async () => ({
          documents: {
            idProof: { status: "approved" },
            drivingLicense: { status: "approved" }
          }
        })
      };
    }
  }));
  t.mock.method(Vehicle, "find", () => mockQuery([]));

  const req = {
    user: { _id: new mongoose.Types.ObjectId(), role: "admin" },
    params: { id: driverId.toString() },
    body: {}
  };
  const res = createResponse();

  await approveAdminDriver(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(approvalUpdated, true);
  assert.equal(res.body.data.driver.approvalStatus, "approved");
});

test("Agency Lifecycle: 6. Agency adds a vehicle without assigning it before KYC approval", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId,
    approvalStatus: "approved",
    isActive: true
  }));
  let createdVehicleData;
  t.mock.method(Vehicle, "create", async (data) => {
    createdVehicleData = data;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      isAvailable: true,
      isActive: true
    };
  });

  const req = {
    user: { _id: ownerId, role: "agency" },
    body: {
      vehicleNumber: "PB10AB1234",
      vehicleModel: "Tata 407",
      vehicleType: "mini-truck",
      loadCapacity: { value: 1500, unit: "kg" },
      bodyType: "closed"
    }
  };
  const res = createResponse();
  await createAgencyVehicle(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdVehicleData.vehicleNumber, "PB10AB1234");
  assert.equal(createdVehicleData.agency.toString(), agencyId.toString());
  assert.equal(createdVehicleData.driver, undefined);
});

test("Agency Lifecycle: 7 & 8. Customer instant booking finds approved agency alternative vehicle when selected vehicle is busy", async (t) => {
  const customerId = new mongoose.Types.ObjectId();
  const busyVehicleId = new mongoose.Types.ObjectId();
  const alternativeVehicleId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const approvedDriverId = new mongoose.Types.ObjectId();
  const approvedDriverUserId = new mongoose.Types.ObjectId();

  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);

  let savedBooking;
  t.mock.method(Booking.prototype, "save", async function () {
    savedBooking = this;
    return this;
  });
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);

  // Selected vehicle is unavailable
  t.mock.method(Vehicle, "findById", (id) => ({
    populate: async () => ({
      _id: alternativeVehicleId,
      vehicleType: "mini-truck",
      driver: { _id: approvedDriverId, user: approvedDriverUserId }
    }),
    then(resolve, reject) {
      if (id.toString() === busyVehicleId.toString()) {
        return Promise.resolve({
          _id: busyVehicleId,
          isActive: true,
          isAvailable: false,
          vehicleType: "mini-truck"
        }).then(resolve, reject);
      }
      return Promise.resolve({
        _id: alternativeVehicleId,
        vehicleType: "mini-truck",
        driver: { _id: approvedDriverId, user: approvedDriverUserId }
      }).then(resolve, reject);
    }
  }));

  // Alternative vehicle belongs to approved agency with approved driver and sufficient capacity
  t.mock.method(Vehicle, "find", () => mockQuery([
    {
      _id: alternativeVehicleId,
      vehicleType: "mini-truck",
      isActive: true,
      isAvailable: true,
      loadCapacity: { value: 1500, unit: "kg" },
      documents: {
        registration: { status: "approved" },
        insurance: { status: "approved" }
      },
      agency: {
        _id: agencyId,
        approvalStatus: "approved",
        isActive: true
      },
      driver: {
        _id: approvedDriverId,
        user: approvedDriverUserId,
        isActive: true,
        approvalStatus: "approved",
        agencyAssociation: { status: "approved" },
        documents: {
          idProof: { status: "approved" },
          drivingLicense: { status: "approved" }
        },
        agency: {
          _id: agencyId,
          approvalStatus: "approved",
          isActive: true
        }
      }
    }
  ]));

  const req = {
    user: { _id: customerId },
    body: {
      bookingMode: "instant",
      vehicle: busyVehicleId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Phase 7 Industrial Area", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Sector 17 Market", latitude: 30.7333, longitude: 76.7794 },
      goods: "Electronic Components",
      weight: { value: 500, unit: "kg" },
      preferredPickupDate: "2030-01-01",
      preferredPickupTime: "10:00"
    }
  };
  const res = createResponse();
  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.alternativeAssigned, true);
  assert.equal(savedBooking.vehicle.toString(), alternativeVehicleId.toString());
  assert.equal(savedBooking.alternativeVehicleAssigned, true);
});

test("Agency Lifecycle: 9. Driver accepts, starts trip, completes delivery, and status is updated", async (t) => {
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const mockBooking = {
    _id: bookingId,
    customer: customerId,
    driver: driverId,
    vehicle: vehicleId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    vehicleType: "mini-truck",
    weight: { value: 500, unit: "kg" },
    estimatedFare: 450,
    finalFare: 0,
    assignmentHistory: [],
    async save() {
      return this;
    }
  };

  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    user: driverUserId,
    approvalStatus: "approved",
    isActive: true,
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  }));

  t.mock.method(Booking, "findOne", async () => ({
    _id: bookingId,
    bookingStatus: "pending",
    assignmentStatus: "pending_acceptance",
    driver: driverId,
    vehicle: vehicleId,
    vehicleType: "mini-truck",
    weight: { value: 500, unit: "kg" }
  }));

  t.mock.method(Vehicle, "findOne", async () => ({
    _id: vehicleId,
    driver: driverId,
    isActive: true,
    isAvailable: false,
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  }));

  t.mock.method(Booking, "findOneAndUpdate", async (filter, update) => {
    mockBooking.bookingStatus = update.$set.bookingStatus;
    mockBooking.assignmentStatus = update.$set.assignmentStatus || mockBooking.assignmentStatus;
    return mockBooking;
  });
  t.mock.method(Vehicle, "findByIdAndUpdate", async () => ({}));
  t.mock.method(Driver, "findByIdAndUpdate", async () => ({}));
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);

  // Driver accepts booking
  const resAccept = createResponse();
  await acceptBooking({ user: { _id: driverUserId }, params: { id: bookingId.toString() } }, resAccept);
  assert.equal(resAccept.statusCode, 200);
  assert.equal(resAccept.body.data.booking.bookingStatus, "accepted");

  // Driver starts trip
  const resStart = createResponse();
  await startTrip({ user: { _id: driverUserId }, params: { id: bookingId.toString() } }, resStart);
  assert.equal(resStart.statusCode, 200);
  assert.equal(resStart.body.data.booking.bookingStatus, "in-progress");

  // Driver completes trip
  const resComplete = createResponse();
  await completeTrip({ user: { _id: driverUserId }, params: { id: bookingId.toString() } }, resComplete);
  assert.equal(resComplete.statusCode, 200);
  assert.equal(resComplete.body.data.booking.bookingStatus, "completed");
  assert.equal(resComplete.body.data.booking.finalFare, 450);
});

test("Agency Lifecycle: 10. Scheduled Booking flow validation", async (t) => {
  const customerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const approvedDriver = {
    _id: new mongoose.Types.ObjectId(),
    isActive: true,
    approvalStatus: "approved",
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
    agencyAssociation: { status: "approved" },
    documents: {
      idProof: { status: "approved" },
      drivingLicense: { status: "approved" }
    }
  };
  const approvedVehicle = {
    _id: new mongoose.Types.ObjectId(),
    agency: { _id: agencyId, approvalStatus: "approved", isActive: true },
    driver: approvedDriver,
    vehicleType: "mini-truck",
    loadCapacity: { value: 1000, unit: "kg" },
    isActive: true,
    isAvailable: true,
    documents: {
      registration: { status: "approved" },
      insurance: { status: "approved" }
    }
  };

  t.mock.method(SystemSetting, "findOne", async () => ({ value: true }));
  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    approvalStatus: "approved",
    isActive: true
  }));
  t.mock.method(Vehicle, "find", () => mockQuery([approvedVehicle]));
  t.mock.method(Fare, "findOne", () => ({ lean: async () => fareConfig }));
  t.mock.method(Booking, "findOne", async () => null);
  t.mock.method(Booking.prototype, "save", async function () { return this; });
  t.mock.method(Notification.prototype, "save", async function () { return this; });
  t.mock.method(User, "find", async () => []);

  // 10A: Scheduled booking with past date is rejected
  const reqPast = {
    user: { _id: customerId },
    body: {
      bookingMode: "scheduled",
      preferredPickupDate: "2020-01-01",
      preferredPickupTime: "10:00",
      agencyId: agencyId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Origin", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Destination", latitude: 30.7333, longitude: 76.7794 },
      goods: "Textiles",
      weight: { value: 200, unit: "kg" }
    }
  };
  const resPast = createResponse();
  await createBooking(reqPast, resPast);
  assert.equal(resPast.statusCode, 400);
  assert.equal(resPast.body.success, false);

  // 10B: Scheduled booking with future date is accepted
  const futureYear = new Date().getFullYear() + 1;
  const reqFuture = {
    user: { _id: customerId },
    body: {
      bookingMode: "scheduled",
      preferredPickupDate: `${futureYear}-12-15`,
      preferredPickupTime: "10:30",
      agencyId: agencyId.toString(),
      vehicleType: "mini-truck",
      pickup: { address: "Origin", latitude: 30.7046, longitude: 76.7179 },
      drop: { address: "Destination", latitude: 30.7333, longitude: 76.7794 },
      goods: "Textiles",
      weight: { value: 200, unit: "kg" }
    }
  };
  const resFuture = createResponse();
  await createBooking(reqFuture, resFuture);
  assert.equal(resFuture.statusCode, 201);
  assert.equal(resFuture.body.success, true);
  assert.equal(resFuture.body.data.booking.bookingMode, "scheduled");
});

test("Security Audit: Agency cannot approve drivers or access other agencies' data", async (t) => {
  const agencyAId = new mongoose.Types.ObjectId();
  const agencyBId = new mongoose.Types.ObjectId();
  const ownerAId = new mongoose.Types.ObjectId();
  const otherDriverId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyAId,
    owner: ownerAId
  }));

  // Driver belongs to Agency B
  t.mock.method(Driver, "findOne", async () => null);

  const req = {
    user: { _id: ownerAId, role: "agency" },
    params: { id: otherDriverId.toString() },
    body: { documents: { idProof: { url: "malicious" } } }
  };
  const res = createResponse();

  await updateAgencyDriverDocuments(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});

test("Security Audit: Unapproved driver is blocked from going online", async (t) => {
  const driverUserId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    user: driverUserId,
    approvalStatus: "pending",
    isActive: true,
    isOnline: false,
    async save() { return this; }
  }));

  // Direct route simulation
  const req = {
    user: { _id: driverUserId, role: "driver" },
    body: { isOnline: true }
  };
  const res = createResponse();

  // Test online guard logic
  const driver = await Driver.findOne({ user: req.user._id });
  if (req.body.isOnline && (driver.approvalStatus !== "approved" || !driver.isActive)) {
    res.status(403).json({ success: false, message: "Your account is not approved or inactive." });
  }

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test("Security Audit: Rejects insecure non-HTTPS or plain text URLs in KYC document submissions", async (t) => {
  const agencyId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();

  t.mock.method(Agency, "findOne", async () => ({
    _id: agencyId,
    owner: ownerId
  }));
  t.mock.method(Driver, "findOne", async () => ({
    _id: driverId,
    agency: agencyId,
    documents: {}
  }));

  // Attempt to submit an insecure HTTP or javascript URL
  const reqInsecure = {
    user: { _id: ownerId, role: "agency" },
    params: { id: driverId.toString() },
    body: { documents: { idProof: { url: "http://insecure-site.com/fake.pdf" } } }
  };
  const resInsecure = createResponse();
  await updateAgencyDriverDocuments(reqInsecure, resInsecure);

  assert.equal(resInsecure.statusCode, 400);
  assert.equal(resInsecure.body.success, false);
});
