import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Booking from "../src/models/Booking.js";
import Complaint from "../src/models/Complaint.js";
import {
  createComplaint,
  getMyComplaints,
  getMyComplaintById,
  getAdminComplaints,
  getAdminComplaintById,
  updateAdminComplaintStatus,
  updateAdminComplaintResponse
} from "../src/controllers/complaintController.js";

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

const chain = (value) => ({
  select() { return chain(value); },
  sort() { return chain(value); },
  skip() { return chain(value); },
  limit() { return chain(value); },
  populate() { return chain(value); },
  then(resolve) { return Promise.resolve(resolve(value)); }
});

const customerId = new mongoose.Types.ObjectId();
const otherCustomerId = new mongoose.Types.ObjectId();
const bookingMongoId = new mongoose.Types.ObjectId();
const bookingCode = "BOOKING-0026";

test("1 & 2: Customer creates complaint with valid booking reference; booking ID and bookingReference are saved", async (t) => {
  t.mock.method(Booking, "findOne", (query) => {
    assert.equal(String(query.customer), String(customerId));
    return chain({
      _id: bookingMongoId,
      bookingId: bookingCode,
      customer: customerId
    });
  });

  let createdDoc = null;
  t.mock.method(Complaint, "create", async (doc) => {
    createdDoc = {
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      async populate() { return this; },
      toObject() { return { ...this }; }
    };
    return createdDoc;
  });

  const res = createResponse();
  await createComplaint({
    user: { _id: customerId },
    body: {
      bookingReference: bookingCode,
      subject: "Driver was late",
      description: "Driver arrived 45 minutes late."
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(String(createdDoc.booking), String(bookingMongoId));
  assert.equal(createdDoc.bookingReference, bookingCode);
  assert.ok(createdDoc.ticketId && createdDoc.ticketId.startsWith("TKT-"));
  assert.equal(res.body.data.complaint.bookingReference, bookingCode);
  assert.equal(res.body.data.complaint.bookingNumber, bookingCode);
});

test("3 & 4: Customer My Tickets and View Details display the same booking number", async (t) => {
  const complaintDoc = {
    _id: new mongoose.Types.ObjectId(),
    ticketId: "TKT-1002",
    raisedBy: { _id: customerId, name: "Customer Test" },
    booking: {
      _id: bookingMongoId,
      bookingId: bookingCode,
      bookingStatus: "completed",
      vehicleType: "mini-truck",
      vehicleName: "Mahindra Jeeto"
    },
    bookingReference: bookingCode,
    subject: "Driver was late",
    description: "Driver arrived 45 minutes late.",
    status: "open",
    adminResponse: "",
    createdAt: new Date(),
    toObject() { return { ...this }; }
  };

  t.mock.method(Complaint, "find", () => chain([complaintDoc]));
  t.mock.method(Complaint, "countDocuments", async () => 1);

  const listRes = createResponse();
  await getMyComplaints({ user: { _id: customerId }, query: {} }, listRes);

  assert.equal(listRes.statusCode, 200);
  assert.equal(listRes.body.data.complaints.length, 1);
  assert.equal(listRes.body.data.complaints[0].ticketId, "TKT-1002");
  assert.equal(listRes.body.data.complaints[0].bookingReference, bookingCode);
  assert.equal(listRes.body.data.complaints[0].bookingNumber, bookingCode);

  t.mock.method(Complaint, "findOne", (query) => {
    assert.equal(String(query.raisedBy), String(customerId));
    return chain(complaintDoc);
  });

  const detailRes = createResponse();
  await getMyComplaintById({ user: { _id: customerId }, params: { id: complaintDoc._id.toString() } }, detailRes);

  assert.equal(detailRes.statusCode, 200);
  assert.equal(detailRes.body.data.complaint.bookingReference, bookingCode);
  assert.equal(detailRes.body.data.complaint.bookingNumber, bookingCode);
  assert.equal(detailRes.body.data.complaint.booking.bookingId, bookingCode);
});

test("5 & 6: Admin ticket list and View Details display the booking number and populated booking info", async (t) => {
  const complaintDoc = {
    _id: new mongoose.Types.ObjectId(),
    ticketId: "TKT-1002",
    raisedBy: { _id: customerId, name: "Customer Test", phone: "9876543210" },
    booking: {
      _id: bookingMongoId,
      bookingId: bookingCode,
      bookingStatus: "in-transit",
      vehicleType: "pickup",
      vehicleName: "Tata Ace",
      createdAt: new Date()
    },
    bookingReference: bookingCode,
    subject: "Cargo delay",
    description: "Goods delayed",
    status: "open",
    createdAt: new Date(),
    toObject() { return { ...this }; }
  };

  t.mock.method(Complaint, "find", () => chain([complaintDoc]));
  t.mock.method(Complaint, "countDocuments", async () => 1);

  const adminListRes = createResponse();
  await getAdminComplaints({ query: { page: "1", limit: "10" } }, adminListRes);

  assert.equal(adminListRes.statusCode, 200);
  assert.equal(adminListRes.body.data.complaints[0].bookingReference, bookingCode);
  assert.equal(adminListRes.body.data.complaints[0].booking.bookingId, bookingCode);

  t.mock.method(Complaint, "findById", () => chain(complaintDoc));

  const adminDetailRes = createResponse();
  await getAdminComplaintById({ params: { id: complaintDoc._id.toString() } }, adminDetailRes);

  assert.equal(adminDetailRes.statusCode, 200);
  assert.equal(adminDetailRes.body.data.complaint.bookingReference, bookingCode);
  assert.equal(adminDetailRes.body.data.complaint.booking.vehicleType, "pickup");
});

test("7 & 8: Customer cannot link another customer's booking and invalid bookings are rejected", async (t) => {
  t.mock.method(Booking, "findOne", (query) => {
    // If querying for another customer's booking, customer filter does not match
    if (String(query.customer) !== String(customerId)) {
      return chain({ _id: bookingMongoId, customer: otherCustomerId });
    }
    return chain(null);
  });

  const res = createResponse();
  await createComplaint({
    user: { _id: customerId },
    body: {
      bookingReference: "BOOKING-9999",
      subject: "Not mine",
      description: "Should fail"
    }
  }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});

test("9 & 10: General complaints without booking references work correctly and existing unlinked tickets remain accessible", async (t) => {
  let createdDoc = null;
  t.mock.method(Complaint, "create", async (doc) => {
    createdDoc = {
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      async populate() { return this; },
      toObject() { return { ...this }; }
    };
    return createdDoc;
  });

  const res = createResponse();
  await createComplaint({
    user: { _id: customerId },
    body: {
      subject: "General app question",
      description: "How do I update my profile?"
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdDoc.booking, null);
  assert.equal(createdDoc.bookingReference, null);
  assert.equal(res.body.data.complaint.bookingReference, null);
  assert.equal(res.body.data.complaint.bookingNumber, null);

  // Existing tickets without booking
  const unlinkedTicket = {
    _id: new mongoose.Types.ObjectId(),
    ticketId: "TKT-0050",
    raisedBy: customerId,
    booking: null,
    bookingReference: null,
    subject: "Old question",
    description: "Old description",
    status: "resolved",
    toObject() { return { ...this }; }
  };

  t.mock.method(Complaint, "findOne", () => chain(unlinkedTicket));
  const fetchRes = createResponse();
  await getMyComplaintById({ user: { _id: customerId }, params: { id: unlinkedTicket._id.toString() } }, fetchRes);

  assert.equal(fetchRes.statusCode, 200);
  assert.equal(fetchRes.body.data.complaint.bookingReference, null);
  assert.equal(fetchRes.body.data.complaint.booking, null);
});

test("11: Ticket replies and status updates remain functional", async (t) => {
  const complaint = {
    _id: new mongoose.Types.ObjectId(),
    status: "open",
    resolvedAt: null,
    adminResponse: "",
    async save() {},
    async populate() {},
    toObject() { return { ...this }; }
  };

  t.mock.method(Complaint, "findById", async () => complaint);
  const statusRes = createResponse();
  await updateAdminComplaintStatus({ params: { id: complaint._id.toString() }, body: { status: "in-review" } }, statusRes);
  assert.equal(statusRes.statusCode, 200);
  assert.equal(complaint.status, "in-review");

  t.mock.method(Complaint, "findByIdAndUpdate", async (id, update) => ({
    _id: id,
    adminResponse: update.$set.adminResponse,
    async populate() {},
    toObject() { return { ...this, adminResponse: update.$set.adminResponse }; }
  }));

  const responseRes = createResponse();
  await updateAdminComplaintResponse({
    params: { id: complaint._id.toString() },
    body: { response: "Our team has contacted the driver." }
  }, responseRes);

  assert.equal(responseRes.statusCode, 200);
  assert.equal(responseRes.body.data.complaint.adminResponse, "Our team has contacted the driver.");
});

test("12: Complaint creation does not alter booking or financial records", async (t) => {
  let bookingUpdated = false;
  t.mock.method(Booking, "findByIdAndUpdate", async () => { bookingUpdated = true; });
  t.mock.method(Booking, "updateOne", async () => { bookingUpdated = true; });

  t.mock.method(Booking, "findOne", () => chain({
    _id: bookingMongoId,
    bookingId: bookingCode,
    customer: customerId,
    bookingStatus: "completed",
    finalFare: 1500
  }));

  t.mock.method(Complaint, "create", async (doc) => ({
    ...doc,
    _id: new mongoose.Types.ObjectId(),
    async populate() { return this; },
    toObject() { return { ...this }; }
  }));

  const res = createResponse();
  await createComplaint({
    user: { _id: customerId },
    body: {
      bookingId: bookingCode,
      subject: "Billing question",
      description: "Need an invoice"
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(bookingUpdated, false, "Booking must never be updated during complaint creation");
});
