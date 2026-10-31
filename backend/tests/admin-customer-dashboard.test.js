import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import adminCustomerRoutes from "../src/routes/adminCustomerRoutes.js";
import {
  getAdminCustomerBookings,
  getAdminCustomerById,
  getAdminCustomerPayments,
  getAdminCustomers
} from "../src/controllers/adminCustomerController.js";

const customerId = "507f1f77bcf86cd799439011";
const otherId = "507f1f77bcf86cd799439012";
const response = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});
const query = (value) => ({
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("customer list enforces customer role, adds actual booking counts, stats, and pagination filters", async (t) => {
  const record = {
    _id: new mongoose.Types.ObjectId(customerId),
    name: "Customer One",
    email: "one@example.test",
    phone: "9990000000",
    role: "customer",
    isActive: true,
    createdAt: new Date("2026-10-10T00:00:00Z"),
    lastLoginAt: null
  };
  let listQuery;
  const countQueries = [];
  t.mock.method(User, "find", (filter) => {
    listQuery = filter;
    return query([record]);
  });
  t.mock.method(User, "countDocuments", async (filter) => {
    countQueries.push(filter);
    if (filter.isActive === true) return 7;
    if (filter.isActive === false) return 3;
    if (filter._id?.$in) return 6;
    if (filter.createdAt) return 2;
    return 10;
  });
  t.mock.method(Booking, "distinct", async (field) => {
    assert.equal(field, "customer");
    return [record._id, new mongoose.Types.ObjectId(otherId)];
  });
  t.mock.method(Booking, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.customer.$in, [record._id]);
    return [{ _id: record._id, count: 4 }];
  });

  const res = response();
  await getAdminCustomers({
    query: {
      page: "2", limit: "5", search: customerId, hasBookings: "true",
      isActive: "true", from: "2026-10-01", to: "2026-10-31",
      recentlyRegistered: "true",
      sortBy: "name", sortOrder: "asc"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(listQuery.role, "customer");
  assert.equal(listQuery.isActive, true);
  assert.deepEqual(listQuery._id.$in, [record._id, new mongoose.Types.ObjectId(otherId)]);
  assert.ok(listQuery.$or.some((condition) => condition._id === customerId));
  assert.equal(listQuery.createdAt, undefined);
  assert.equal(listQuery.$and[0].createdAt.$gte.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(listQuery.$and[0].createdAt.$lt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.ok(listQuery.$and[1].createdAt.$gte instanceof Date);
  assert.equal(res.body.data.customers[0].bookingCount, 4);
  assert.equal(res.body.data.customers[0].lastLoginAt, null);
  assert.deepEqual(res.body.data.stats, {
    total: 10, active: 7, inactive: 3, recentlyRegistered: 2, withBookings: 6, withoutBookings: 4
  });
  assert.deepEqual(res.body.data.pagination, { page: 2, limit: 5, total: 7, totalPages: 2 });
  assert.ok(countQueries.every((filter) => filter.role === "customer"));
});

test("customer detail returns ID-linked booking statistics and actual net payments", async (t) => {
  const customer = {
    _id: new mongoose.Types.ObjectId(customerId),
    name: "Customer One",
    role: "customer",
    isActive: true,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    lastLoginAt: null
  };
  const aggregateCalls = [];
  t.mock.method(User, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: customerId, role: "customer" });
    return query(customer);
  });
  t.mock.method(Booking, "aggregate", async (pipeline) => {
    aggregateCalls.push(pipeline);
    return [{ _id: "pending", count: 2 }, { _id: "completed", count: 3 }, { _id: "in-progress", count: 1 }];
  });
  t.mock.method(Payment, "aggregate", async (pipeline) => {
    aggregateCalls.push(pipeline);
    assert.deepEqual(pipeline[0].$match, { customer: customer._id });
    return [{ totalNetPaid: 125 }];
  });

  const res = response();
  await getAdminCustomerById({ params: { id: customerId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.customer.id.toString(), customerId);
  assert.equal(res.body.data.customer.lastLoginAt, null);
  assert.deepEqual(res.body.data.stats.bookings, {
    total: 6, pending: 2, accepted: 0, rejected: 0, inProgress: 1, completed: 3, cancelled: 0
  });
  assert.equal(res.body.data.stats.totalNetPaid, 125);
  assert.equal(aggregateCalls.length, 2);
});

test("customer bookings and payments are scoped by customer ID and paginated", async (t) => {
  const booking = { _id: "booking-id", bookingId: "LB-100", customer: customerId };
  const payment = { _id: "payment-id", amount: 300, booking: { bookingId: "LB-100" } };
  let bookingQuery;
  let paymentQuery;
  t.mock.method(User, "exists", async (filter) => {
    assert.deepEqual(filter, { _id: customerId, role: "customer" });
    return { _id: customerId };
  });
  t.mock.method(Booking, "find", (filter) => {
    bookingQuery = filter;
    return query([booking]);
  });
  t.mock.method(Booking, "countDocuments", async () => 1);
  t.mock.method(Payment, "find", (filter) => {
    paymentQuery = filter;
    return query([payment]);
  });
  t.mock.method(Payment, "countDocuments", async () => 1);

  const bookingsRes = response();
  await getAdminCustomerBookings({
    params: { id: customerId },
    query: { page: "2", limit: "5", bookingStatus: "completed", search: "LB-100" }
  }, bookingsRes);
  assert.equal(bookingsRes.statusCode, 200);
  assert.deepEqual(bookingQuery, {
    customer: customerId,
    bookingStatus: "completed",
    bookingId: /LB-100/i
  });
  assert.equal(bookingsRes.body.data.bookings[0], booking);
  assert.equal(bookingsRes.body.data.pagination.page, 2);

  const paymentsRes = response();
  await getAdminCustomerPayments({ params: { id: customerId }, query: { page: "1", limit: "5" } }, paymentsRes);
  assert.equal(paymentsRes.statusCode, 200);
  assert.deepEqual(paymentQuery, { customer: customerId });
  assert.equal(paymentsRes.body.data.payments[0], payment);
  assert.equal(paymentsRes.body.data.pagination.total, 1);
});

test("invalid customer ids fail and all added history routes retain admin middleware", async () => {
  const invalidBookings = response();
  await getAdminCustomerBookings({ params: { id: "invalid" }, query: {} }, invalidBookings);
  assert.equal(invalidBookings.statusCode, 400);
  const invalidPayments = response();
  await getAdminCustomerPayments({ params: { id: "invalid" }, query: {} }, invalidPayments);
  assert.equal(invalidPayments.statusCode, 400);

  const routerLayers = adminCustomerRoutes.stack.filter((layer) => layer.route);
  assert.ok(routerLayers.some((layer) => layer.route.path === "/:id/bookings"));
  assert.ok(routerLayers.some((layer) => layer.route.path === "/:id/payments"));
  assert.ok(adminCustomerRoutes.stack.some((layer) => !layer.route && layer.handle.name === "protect"));
  assert.ok(adminCustomerRoutes.stack.some((layer) => !layer.route && layer.handle.name === "adminOnly"));
});
