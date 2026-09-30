import assert from "node:assert/strict";
import test from "node:test";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import Vehicle from "../src/models/Vehicle.js";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import Complaint from "../src/models/Complaint.js";
import Rating from "../src/models/Rating.js";
import { adminOnly } from "../src/middleware/adminMiddleware.js";
import {
  getAdminCustomerById,
  getAdminCustomers,
  updateAdminCustomerStatus
} from "../src/controllers/adminCustomerController.js";
import {
  approveAdminDriver,
  getAdminDrivers,
  rejectAdminDriver,
  suspendAdminDriver,
  updateAdminDriverStatus
} from "../src/controllers/adminDriverController.js";
import {
  getAdminPaymentById,
  getAdminPayments
} from "../src/controllers/adminPaymentController.js";
import {
  createComplaint,
  getAdminComplaints,
  getMyComplaintById,
  updateAdminComplaintResponse,
  updateAdminComplaintStatus
} from "../src/controllers/complaintController.js";
import {
  createRating,
  getAdminRatings
} from "../src/controllers/ratingController.js";
import {
  getAdminDriverEarnings,
  getDriverEarnings,
  getDriverEarningsSummary
} from "../src/controllers/driverEarningsController.js";

const objectId = "507f1f77bcf86cd799439011";
const otherObjectId = "507f1f77bcf86cd799439012";

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

const chain = (value) => ({
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("admin-only middleware distinguishes unauthenticated, customer, driver, and admin", () => {
  for (const [user, status] of [
    [null, 401],
    [{ role: "customer" }, 403],
    [{ role: "driver" }, 403]
  ]) {
    const res = createResponse();
    adminOnly({ user }, res, () => assert.fail("must not allow non-admin"));
    assert.equal(res.statusCode, status);
  }
  let continued = false;
  adminOnly({ user: { role: "admin" } }, createResponse(), () => { continued = true; });
  assert.equal(continued, true);
});

test("admin customer list paginates, searches, filters, and returns safe fields", async (t) => {
  let receivedQuery;
  let selectedFields;
  t.mock.method(User, "find", (query) => {
    receivedQuery = query;
    const result = [{
      _id: objectId,
      name: "Customer",
      phone: "123",
      email: "customer@example.com",
      profileImage: "",
      role: "customer",
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: null,
      password: "never-return",
      jwt: "never-return"
    }];
    const resultChain = chain(result);
    resultChain.select = (fields) => { selectedFields = fields; return resultChain; };
    return resultChain;
  });
  t.mock.method(User, "countDocuments", async () => 1);
  const res = createResponse();

  await getAdminCustomers({ query: { page: "1", limit: "5", search: "cust", isActive: "true" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(receivedQuery.role, "customer");
  assert.equal(receivedQuery.isActive, true);
  assert.deepEqual(Object.keys(receivedQuery.$or), ["0", "1", "2"]);
  assert.equal(selectedFields.includes("password"), false);
  assert.deepEqual(res.body.data.pagination, { page: 1, limit: 5, total: 1, totalPages: 1 });
  assert.equal("password" in res.body.data.customers[0], false);
  assert.equal("jwt" in res.body.data.customers[0], false);
});

test("admin customer details and status updates are customer-scoped and safe", async (t) => {
  let update;
  t.mock.method(User, "findOneAndUpdate", (...args) => {
    update = args;
    return chain({ _id: objectId, name: "A", role: "customer", isActive: false, password: "hidden" });
  });
  const res = createResponse();
  await updateAdminCustomerStatus({ params: { id: objectId }, body: { isActive: false } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update[0], { _id: objectId, role: "customer" });
  assert.deepEqual(update[1], { $set: { isActive: false } });
  assert.equal("password" in res.body.data.customer, false);

  let findOneCalled = false;
  t.mock.method(User, "findOne", () => {
    findOneCalled = true;
    return chain(null);
  });
  const invalidRes = createResponse();
  await updateAdminCustomerStatus({ params: { id: objectId }, body: { isActive: true, role: "admin" } }, invalidRes);
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(findOneCalled, false);

  const detailRes = createResponse();
  await getAdminCustomerById({ params: { id: objectId } }, detailRes);
  assert.equal(detailRes.statusCode, 404);
});

test("admin driver filters, paginates, and excludes KYC fields", async (t) => {
  let driverQuery;
  t.mock.method(Driver, "find", (query) => {
    driverQuery = query;
    return chain([{
      _id: objectId,
      fullName: "Driver",
      phone: "123",
      approvalStatus: "pending",
      isOnline: false,
      isActive: true,
      rating: 4,
      totalTrips: 2,
      documents: { idProof: { url: "private" } },
      user: { name: "Driver", phone: "123", email: "driver@example.com" }
    }]);
  });
  t.mock.method(Driver, "countDocuments", async () => 1);
  t.mock.method(Vehicle, "find", () => chain([{
    _id: otherObjectId,
    driver: objectId,
    vehicleNumber: "ABC",
    vehicleModel: "Truck",
    vehicleType: "pickup",
    loadCapacity: { value: 1, unit: "ton" },
    isAvailable: true,
    isActive: true,
    registrationDocument: "private"
  }]));
  const res = createResponse();

  await getAdminDrivers({ query: { page: "1", limit: "3", approvalStatus: "pending", isOnline: "false" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(driverQuery.approvalStatus, "pending");
  assert.equal(driverQuery.isOnline, false);
  assert.equal(res.body.data.drivers[0].vehicles.length, 1);
  assert.equal("documents" in res.body.data.drivers[0], false);
  assert.equal("registrationDocument" in res.body.data.drivers[0].vehicles[0], false);
});

test("admin driver approval is an explicit action and arbitrary statuses are rejected", async (t) => {
  let update;
  t.mock.method(Driver, "findByIdAndUpdate", (...args) => {
    update = args;
    return {
      populate() {
        return Promise.resolve({
          _id: objectId,
          fullName: "Driver",
          approvalStatus: "approved",
          documents: { idProof: { url: "secret" } },
          user: { name: "Driver" }
        });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => chain([]));
  const res = createResponse();
  await approveAdminDriver({ params: { id: objectId }, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update[1], { $set: { approvalStatus: "approved" } });
  assert.equal("documents" in res.body.data.driver, false);

  const invalid = createResponse();
  await updateAdminDriverStatus({ params: { id: objectId }, body: { approvalStatus: "admin" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("admin driver reject and suspend actions set only their fixed approval states", async (t) => {
  const approvalStates = [];
  t.mock.method(Driver, "findByIdAndUpdate", (id, update) => {
    approvalStates.push(update.$set.approvalStatus);
    return {
      populate() {
        return Promise.resolve({ _id: id, fullName: "Driver", approvalStatus: update.$set.approvalStatus });
      }
    };
  });
  t.mock.method(Vehicle, "find", () => chain([]));

  const rejected = createResponse();
  await rejectAdminDriver({ params: { id: objectId }, body: {} }, rejected);
  const suspended = createResponse();
  await suspendAdminDriver({ params: { id: objectId }, body: {} }, suspended);

  assert.equal(rejected.statusCode, 200);
  assert.equal(suspended.statusCode, 200);
  assert.deepEqual(approvalStates, ["rejected", "suspended"]);
});

test("admin payment list filters, paginates, and projects only safe payment fields", async (t) => {
  let paymentQuery;
  t.mock.method(Payment, "find", (query) => {
    paymentQuery = query;
    return chain([{
      _id: objectId,
      booking: { _id: otherObjectId, bookingId: "LB-123" },
      customer: { _id: objectId, name: "Customer", phone: "123", email: "c@example.com", password: "hidden" },
      amount: 10,
      method: "online",
      provider: "razorpay",
      status: "success",
      orderId: "order",
      transactionId: "txn",
      refundId: "",
      refundAmount: 0,
      cardNumber: "hidden",
      razorpayKeySecret: "hidden"
    }]);
  });
  t.mock.method(Payment, "countDocuments", async () => 1);
  const res = createResponse();
  await getAdminPayments({
    query: { page: "1", limit: "5", status: "success", method: "online", provider: "razorpay", transactionId: "tx" }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(paymentQuery.status, "success");
  assert.equal(paymentQuery.method, "online");
  assert.equal(paymentQuery.provider, "razorpay");
  assert.equal(res.body.data.payments[0].bookingId, "LB-123");
  assert.equal("cardNumber" in res.body.data.payments[0], false);
  assert.equal("razorpayKeySecret" in res.body.data.payments[0], false);

  t.mock.method(Payment, "findById", () => chain(null));
  const detailRes = createResponse();
  await getAdminPaymentById({ params: { id: objectId } }, detailRes);
  assert.equal(detailRes.statusCode, 404);
});

test("customer complaint creation attaches only an owned booking", async (t) => {
  t.mock.method(Booking, "findOne", (query) => {
    assert.equal(query.customer, objectId);
    return chain({ _id: otherObjectId });
  });
  let created;
  t.mock.method(Complaint, "create", async (document) => {
    created = document;
    return document;
  });
  const res = createResponse();
  await createComplaint({
    user: { _id: objectId },
    body: { bookingId: otherObjectId, subject: "Late", description: "The shipment was delayed." }
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.booking, otherObjectId);
  assert.equal(created.raisedBy, objectId);
});

test("customer complaint creation rejects another customer's booking", async (t) => {
  t.mock.method(Booking, "findOne", () => chain(null));
  let created = false;
  t.mock.method(Complaint, "create", async () => { created = true; });
  const res = createResponse();
  await createComplaint({
    user: { _id: objectId },
    body: { bookingId: otherObjectId, subject: "Issue", description: "Not my booking" }
  }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(created, false);
});

test("customer complaint details are ownership-scoped and admin filters paginate", async (t) => {
  let complaintQuery;
  t.mock.method(Complaint, "findOne", (query) => {
    complaintQuery = query;
    return chain(null);
  });
  const customerRes = createResponse();
  await getMyComplaintById({ user: { _id: objectId }, params: { id: otherObjectId } }, customerRes);
  assert.equal(customerRes.statusCode, 404);
  assert.equal(complaintQuery.raisedBy, objectId);

  t.mock.method(Complaint, "find", (query) => {
    complaintQuery = query;
    return chain([]);
  });
  t.mock.method(Complaint, "countDocuments", async () => 0);
  const adminRes = createResponse();
  await getAdminComplaints({ query: { status: "open", page: "2", limit: "4" } }, adminRes);
  assert.equal(adminRes.statusCode, 200);
  assert.equal(complaintQuery.status, "open");
  assert.equal(adminRes.body.data.pagination.page, 2);
});

test("complaint status transition rejects invalid reopening from closed", async (t) => {
  let saved = false;
  t.mock.method(Complaint, "findById", async () => ({
    status: "closed",
    async save() { saved = true; },
    async populate() {}
  }));
  const res = createResponse();
  await updateAdminComplaintStatus({ params: { id: objectId }, body: { status: "open" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(saved, false);
});

test("complaint status advances safely and admin response is persisted", async (t) => {
  const complaint = {
    status: "open",
    resolvedAt: null,
    adminResponse: "",
    async save() {},
    async populate() {}
  };
  t.mock.method(Complaint, "findById", async () => complaint);
  const statusRes = createResponse();
  await updateAdminComplaintStatus({ params: { id: objectId }, body: { status: "in-review" } }, statusRes);
  assert.equal(statusRes.statusCode, 200);
  assert.equal(complaint.status, "in-review");

  t.mock.method(Complaint, "findByIdAndUpdate", async (id, update) => ({
    _id: id,
    adminResponse: update.$set.adminResponse,
    async populate() {}
  }));
  const responseRes = createResponse();
  await updateAdminComplaintResponse({ params: { id: objectId }, body: { response: "We are investigating." } }, responseRes);
  assert.equal(responseRes.statusCode, 200);
  assert.equal(responseRes.body.data.complaint.adminResponse, "We are investigating.");
});

test("ratings require own completed booking, reject duplicates, and update driver average atomically", async (t) => {
  const booking = { _id: objectId, driver: otherObjectId, bookingStatus: "completed" };
  t.mock.method(Booking, "findOne", async () => booking);
  t.mock.method(Rating, "exists", async () => null);
  let created;
  t.mock.method(Rating, "create", async (rating) => {
    created = {
      ...rating,
      async populate() {}
    };
    return created;
  });
  let driverUpdate;
  t.mock.method(Driver, "updateOne", async (...args) => {
    driverUpdate = args;
    return { matchedCount: 1 };
  });
  const res = createResponse();
  await createRating({
    user: { _id: objectId },
    body: { bookingId: objectId, rating: 5, feedback: "Great" }
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.driver, otherObjectId);
  assert.ok(Array.isArray(driverUpdate[1]));

  t.mock.method(Rating, "exists", async () => ({ _id: otherObjectId }));
  const duplicate = createResponse();
  await createRating({ user: { _id: objectId }, body: { bookingId: objectId, rating: 4 } }, duplicate);
  assert.equal(duplicate.statusCode, 409);
});

test("rating list validates filter and pagination; customer cannot rate incomplete booking", async (t) => {
  t.mock.method(Booking, "findOne", async () => ({ _id: objectId, driver: otherObjectId, bookingStatus: "accepted" }));
  const incomplete = createResponse();
  await createRating({ user: { _id: objectId }, body: { bookingId: objectId, rating: 5 } }, incomplete);
  assert.equal(incomplete.statusCode, 400);

  const invalid = createResponse();
  await getAdminRatings({ query: { rating: "6" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  const repeatedRating = createResponse();
  await getAdminRatings({ query: { rating: ["5", "4"] } }, repeatedRating);
  assert.equal(repeatedRating.statusCode, 400);
});

test("customer cannot rate another customer's booking or submit out-of-range ratings", async (t) => {
  t.mock.method(Booking, "findOne", async () => null);
  const foreignBooking = createResponse();
  await createRating({ user: { _id: objectId }, body: { bookingId: objectId, rating: 5 } }, foreignBooking);
  assert.equal(foreignBooking.statusCode, 404);

  const invalidRating = createResponse();
  await createRating({ user: { _id: objectId }, body: { bookingId: objectId, rating: 0 } }, invalidRating);
  assert.equal(invalidRating.statusCode, 400);
});

test("driver earnings are restricted to own completed bookings and admin can filter by driver", async (t) => {
  const driver = { _id: objectId, toString: () => objectId };
  t.mock.method(Driver, "findOne", () => chain(driver));
  let matches = [];
  t.mock.method(Booking, "aggregate", async (pipeline) => {
    const match = pipeline[0].$match;
    matches.push(match);
    return [{ completedTrips: 2, totalEarnings: 125 }];
  });
  t.mock.method(Booking, "find", (query) => {
    matches.push(query);
    return chain([{ bookingId: "LB-1", finalFare: 50 }]);
  });
  t.mock.method(Booking, "countDocuments", async () => 2);
  const res = createResponse();
  await getDriverEarnings({ user: { _id: otherObjectId }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.totalTrips, 2);
  assert.equal(res.body.data.totalEarnings, 125);
  assert.ok(matches.every((match) => match.driver === objectId && match.bookingStatus === "completed"));

  const forbidden = createResponse();
  await getDriverEarnings({ user: { _id: otherObjectId }, query: { driverId: otherObjectId } }, forbidden);
  assert.equal(forbidden.statusCode, 403);

  t.mock.method(Driver, "exists", async () => true);
  const adminRes = createResponse();
  await getAdminDriverEarnings({ query: { driverId: objectId, page: "1", limit: "10" } }, adminRes);
  assert.equal(adminRes.statusCode, 200);
  assert.equal(adminRes.body.data.totalEarnings, 125);
});

test("driver earnings summary includes only completed-trip earnings", async (t) => {
  t.mock.method(Driver, "findOne", () => chain({ _id: objectId, toString: () => objectId }));
  const matches = [];
  t.mock.method(Booking, "aggregate", async (pipeline) => {
    matches.push(pipeline[0].$match);
    return [{ completedTrips: 3, totalEarnings: 400 }];
  });
  const res = createResponse();
  await getDriverEarningsSummary({ user: { _id: otherObjectId }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.completedTrips, 3);
  assert.equal("earnings" in res.body.data, false);
  assert.ok(matches.every((match) => match.driver === objectId && match.bookingStatus === "completed"));
});
