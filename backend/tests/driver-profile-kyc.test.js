import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import cloudinary from "../src/config/cloudinary.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import { reviewAdminDriverDocument } from "../src/controllers/adminDriverController.js";
import { getDriverProfile } from "../src/routes/driverRoutes.js";

const response = () => ({
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

const driverQuery = (driver) => ({
  populate() { return this; },
  then(resolve, reject) { return Promise.resolve(driver).then(resolve, reject); }
});

const vehicleQuery = (vehicle) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(vehicle); }
});

const makeDriver = ({ userId, driverId, idProofStatus, licenseStatus }) => ({
  _id: driverId,
  user: userId,
  fullName: "Linked Driver",
  agency: {
    _id: new mongoose.Types.ObjectId(),
    agencyName: "Fleet Agency",
  },
  agencyAssociation: { status: "approved" },
  approvalStatus: "pending",
  documents: {
    idProof: {
      status: idProofStatus,
      publicId: idProofStatus === "not_uploaded" ? "" : "loadbalbin_kyc/driver-aadhaar",
      url: idProofStatus === "not_uploaded" ? "" : "https://private.example/driver-aadhaar",
      submittedAt: idProofStatus === "not_uploaded" ? null : new Date("2026-02-01T10:00:00Z")
    },
    drivingLicense: {
      status: licenseStatus,
      publicId: licenseStatus === "not_uploaded" ? "" : "loadbalbin_kyc/driver-license",
      url: licenseStatus === "not_uploaded" ? "" : "https://private.example/driver-license",
      submittedAt: licenseStatus === "not_uploaded" ? null : new Date("2026-02-02T10:00:00Z")
    },
    vehicleRegistration: { status: "approved", publicId: "loadbalbin_kyc/legacy-driver-rc" },
    insurance: { status: "approved", publicId: "loadbalbin_kyc/legacy-driver-insurance" }
  },
  toObject() {
    return {
      _id: this._id,
      user: this.user,
      fullName: this.fullName,
      agency: { ...this.agency },
      agencyAssociation: { ...this.agencyAssociation },
      approvalStatus: this.approvalStatus,
      documents: structuredClone(this.documents)
    };
  },
  markModified() {},
  async save() {
    return this;
  }
});

test("driver profile refresh reads personal KYC from Driver and vehicle KYC from assigned Vehicle records", async (t) => {
  const userId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const replacementVehicleId = new mongoose.Types.ObjectId();
  const agencyOwnerAadhaar = "loadbalbin_kyc/agency-owner-aadhaar";
  const driver = makeDriver({ userId, driverId, idProofStatus: "pending", licenseStatus: "pending" });
  const vehicles = [
    [{
      _id: new mongoose.Types.ObjectId(),
      vehicleNumber: "OLD-100",
      vehicleModel: "Old Vehicle",
      agency: new mongoose.Types.ObjectId(),
      documents: {
        registration: {
          url: "https://private.example/old-rc",
          publicId: "loadbalbin_kyc/old-rc",
          status: "pending",
          submittedAt: new Date("2026-02-03T10:00:00Z")
        },
        insurance: {
          url: "https://private.example/old-insurance",
          publicId: "loadbalbin_kyc/old-insurance",
          status: "pending",
          submittedAt: new Date("2026-02-03T11:00:00Z")
        }
      }
    }],
    [{
      _id: replacementVehicleId,
      vehicleNumber: "NEW-200",
      vehicleModel: "Replacement Vehicle",
      agency: new mongoose.Types.ObjectId(),
      documents: {
        registration: {
          url: "https://private.example/new-rc",
          publicId: "loadbalbin_kyc/new-rc",
          status: "approved",
          submittedAt: new Date("2026-02-04T10:00:00Z")
        },
        insurance: {
          url: "https://private.example/new-insurance",
          publicId: "loadbalbin_kyc/new-insurance",
          status: "pending",
          submittedAt: new Date("2026-02-05T10:00:00Z")
        }
      }
    }]
  ];
  let vehicleCall = 0;
  t.mock.method(Driver, "findOne", () => driverQuery(driver));
  t.mock.method(Driver, "findById", async (requestedDriverId) => {
    assert.equal(requestedDriverId.toString(), driverId.toString());
    return driver;
  });
  t.mock.method(Vehicle, "find", (filter) => {
    assert.deepEqual(filter, { driver: driverId });
    return vehicleQuery(vehicles[vehicleCall++]);
  });
  t.mock.method(cloudinary.utils, "private_download_url", () => "https://signed.example/short-lived");

  const firstResponse = response();
  await getDriverProfile({ user: { _id: userId } }, firstResponse);
  const firstProfile = firstResponse.body.data.driver;
  assert.equal(firstProfile.documents.idProof.status, "pending");
  assert.equal(firstProfile.documents.drivingLicense.status, "pending");
  assert.equal(firstProfile.vehicles[0].vehicleNumber, "OLD-100");
  assert.equal(firstProfile.vehicles[0].documents.registration.status, "pending");
  assert.equal(firstProfile.vehicles[0].documents.registration.submittedAt.toISOString(), "2026-02-03T10:00:00.000Z");
  assert.equal(firstProfile.vehicles[0].documents.insurance.status, "pending");
  assert.equal(firstProfile.documents.idProof.publicId, undefined);
  assert.deepEqual(Object.keys(firstProfile.documents).sort(), ["drivingLicense", "idProof"]);
  assert.equal(driver.documents.vehicleRegistration.status, "approved");
  assert.equal(firstProfile.vehicles[0].documents.registration.publicId, undefined);

  for (const docType of ["idProof", "drivingLicense"]) {
    const reviewResponse = response();
    await reviewAdminDriverDocument({
      params: { id: driverId.toString(), docType, action: "approve" },
      body: {},
      user: { _id: new mongoose.Types.ObjectId() }
    }, reviewResponse);
    assert.equal(reviewResponse.statusCode, 200);
  }

  const secondResponse = response();
  await getDriverProfile({ user: { _id: userId } }, secondResponse);
  const refreshedProfile = secondResponse.body.data.driver;
  assert.equal(refreshedProfile.documents.idProof.status, "approved");
  assert.equal(refreshedProfile.documents.drivingLicense.status, "approved");
  assert.equal(refreshedProfile.documents.idProof.viewUrl, "https://signed.example/short-lived");
  assert.equal(refreshedProfile.vehicles[0]._id.toString(), replacementVehicleId.toString());
  assert.equal(refreshedProfile.vehicles[0].vehicleNumber, "NEW-200");
  assert.equal(refreshedProfile.vehicles[0].documents.registration.status, "approved");
  assert.equal(refreshedProfile.vehicles[0].documents.insurance.status, "pending");
  assert.notEqual(driver.documents.idProof.publicId, agencyOwnerAadhaar);
  assert.ok(refreshedProfile.documents.idProof.reviewedAt);
  assert.equal(vehicleCall, 2);
});
