import assert from "node:assert/strict";
import test from "node:test";
import { getDriverBookingEligibility } from "./driverBookingEligibility.mjs";

const approvedDriver = () => ({
  isActive: true,
  approvalStatus: "approved",
  documents: {
    idProof: { status: "approved" },
    drivingLicense: { status: "approved" }
  }
});

test("booking eligibility blocks identity documents pending review", () => {
  const driver = approvedDriver();
  driver.documents.idProof.status = "pending";

  const result = getDriverBookingEligibility(driver);

  assert.equal(result.eligible, false);
  assert.equal(result.title, "Identity verification required");
  assert.match(result.message, /Identity Proof \(Aadhaar\) is pending administrator review/);
});

test("booking eligibility reports rejected documents and reason", () => {
  const driver = approvedDriver();
  driver.documents.drivingLicense.status = "rejected";
  driver.documents.drivingLicense.rejectionReason = "Photo is unreadable";

  const result = getDriverBookingEligibility(driver);

  assert.equal(result.eligible, false);
  assert.match(result.message, /Driving Licence was rejected: Photo is unreadable/);
});

test("booking eligibility allows an active approved driver with both approved identity documents", () => {
  assert.deepEqual(getDriverBookingEligibility(approvedDriver()), {
    eligible: true,
    title: "",
    message: ""
  });
});

test("booking eligibility separately blocks non-approved or inactive accounts", () => {
  const driver = approvedDriver();
  driver.approvalStatus = "suspended";
  assert.equal(getDriverBookingEligibility(driver).title, "Driver account suspended");

  driver.approvalStatus = "approved";
  driver.isActive = false;
  assert.equal(getDriverBookingEligibility(driver).title, "Driver account inactive");
});
