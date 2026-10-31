import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import User from "../src/models/User.js";
import adminPaymentRoutes from "../src/routes/adminPaymentRoutes.js";
import { getAdminPaymentById, getAdminPayments } from "../src/controllers/adminPaymentController.js";
import { processWebhook, recordRefundResponse, refundPayment } from "../src/controllers/paymentController.js";
import { env } from "../src/config/env.js";

const paymentId = "507f1f77bcf86cd799439011";
const bookingObjectId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439012");
const customerObjectId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439013");
const response = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});
const query = (value) => ({
  selected: "",
  populated: [],
  sorted: null,
  select(fields) { this.selected = fields; return this; },
  populate(path, fields) { this.populated.push([path, fields]); return this; },
  sort(value) { this.sorted = value; return this; },
  skip() { return this; },
  limit() { return this; },
  lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test("admin payment list returns real records, global status summaries, and observed facets", async (t) => {
  const payment = {
    _id: new mongoose.Types.ObjectId(paymentId),
    booking: {
      _id: bookingObjectId,
      bookingId: "LB-2001",
      pickup: { address: "Origin" },
      drop: { address: "Destination" },
      bookingMode: "scheduled",
      vehicleType: "mini-truck",
      estimatedFare: 700,
      finalFare: 650,
      bookingStatus: "completed",
      paymentStatus: "paid",
      preferredPickupDate: new Date("2026-10-30T10:00:00Z"),
      preferredPickupTime: "10:00",
      createdAt: new Date("2026-10-20T10:00:00Z")
    },
    customer: { _id: customerObjectId, name: "Customer One", phone: "9000000000", email: "one@example.test" },
    amount: 650,
    method: "online",
    provider: "razorpay",
    transactionId: "pay_actual",
    orderId: "order_actual",
    status: "success",
    paidAt: new Date("2026-10-20T10:05:00Z"),
    refundId: "",
    refundAmount: 0,
    refundStatus: null,
    createdAt: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:05:00Z")
  };
  let listFilter;
  let sortOptions;
  t.mock.method(Payment, "find", (filter) => {
    listFilter = filter;
    const cursor = query([payment]);
    const originalSort = cursor.sort.bind(cursor);
    cursor.sort = (sort) => { sortOptions = sort; return originalSort(sort); };
    return cursor;
  });
  t.mock.method(Payment, "countDocuments", async () => 1);
  t.mock.method(Payment, "aggregate", async (pipeline) => {
    assert.equal(pipeline[0].$group._id, null);
    const group = pipeline[0].$group;
    assert.deepEqual(group.successfulAmount.$sum.$cond[0], { $eq: ["$status", "success"] });
    assert.deepEqual(group.successfulAmount.$sum.$cond[1].$cond[0], { $eq: ["$refundStatus", "processed"] });
    assert.deepEqual(group.refundedAmount.$sum.$cond[0].$or[0], { $eq: ["$status", "refunded"] });
    assert.deepEqual(group.refundedAmount.$sum.$cond[0].$or[1].$and[1], { $eq: ["$refundStatus", "processed"] });
    return [{
      total: 8, successful: 3, pending: 2, failed: 1, refunded: 2,
      successfulAmount: 2000, refundedAmount: 450
    }];
  });
  t.mock.method(Payment, "distinct", async (field) => {
    assert.equal(field, "provider");
    return ["razorpay", ""];
  });

  const res = response();
  await getAdminPayments({
    query: {
      page: "2", limit: "5", status: "success", method: "online",
      provider: "razorpay", from: "2026-10-01", to: "2026-10-31",
      sortBy: "amount", sortOrder: "asc"
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(listFilter, {
    status: "success",
    method: "online",
    provider: "razorpay",
    createdAt: { $gte: new Date("2026-10-01T00:00:00.000Z"), $lt: new Date("2026-11-01T00:00:00.000Z") }
  });
  assert.deepEqual(sortOptions, { amount: 1, _id: -1 });
  assert.equal(res.body.data.payments[0].booking.bookingId, "LB-2001");
  assert.equal(res.body.data.payments[0].customer.id, customerObjectId);
  assert.equal(res.body.data.payments[0].refundEligible, true);
  assert.deepEqual(res.body.data.summary, {
    total: 8, successful: 3, pending: 2, failed: 1, refunded: 2,
    successfulAmount: 2000, refundedAmount: 450
  });
  assert.deepEqual(res.body.data.facets, {
    statuses: ["pending", "success", "failed", "refunded"],
    methods: ["online", "cash"],
    providers: ["razorpay"]
  });
  assert.deepEqual(res.body.data.pagination, { page: 2, limit: 5, total: 1, totalPages: 1 });
});

test("admin payment search combines IDs, booking/customer relations, and escaped gateway references", async (t) => {
  const booking = { _id: bookingObjectId };
  const customer = { _id: customerObjectId };
  let paymentFilter;
  t.mock.method(Booking, "find", (filter) => {
    assert.equal(filter.bookingId.source, "LB\\.20");
    return query([booking]);
  });
  t.mock.method(User, "find", (filter) => {
    assert.equal(filter.$or[0].name.source, "LB\\.20");
    return query([customer]);
  });
  t.mock.method(Payment, "find", (filter) => { paymentFilter = filter; return query([]); });
  t.mock.method(Payment, "countDocuments", async () => 0);
  t.mock.method(Payment, "aggregate", async () => []);
  t.mock.method(Payment, "distinct", async () => []);

  const res = response();
  await getAdminPayments({ query: { search: "LB.20" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(paymentFilter.$or[0].transactionId.source, "LB\\.20");
  assert.equal(paymentFilter.$or[1].orderId.source, "LB\\.20");
  assert.deepEqual(paymentFilter.$or[2].booking.$in, [bookingObjectId]);
  assert.deepEqual(paymentFilter.$or[3].customer.$in, [customerObjectId]);
  assert.equal(paymentFilter.$or[4].$expr.$regexMatch.regex, "LB\\.20");
  assert.equal(res.body.data.summary.total, 0);
});

test("admin payment detail resolves safe customer, booking, and refund fields", async (t) => {
  const payment = {
    _id: new mongoose.Types.ObjectId(paymentId),
    booking: { _id: bookingObjectId, bookingId: "LB-2001", pickup: { address: "Origin" } },
    customer: { _id: customerObjectId, name: "Customer One", phone: "9000000000", email: "" },
    amount: 500,
    method: "online",
    provider: "razorpay",
    transactionId: "pay_actual",
    orderId: "order_actual",
    status: "success",
    refundId: "rfnd_actual",
    refundAmount: 100,
    refundStatus: "pending",
    refundInitiatedAt: new Date("2026-10-25T10:00:00Z")
  };
  let detailQuery;
  t.mock.method(Payment, "findById", (id) => {
    assert.equal(id, paymentId);
    detailQuery = query(payment);
    return detailQuery;
  });

  const res = response();
  await getAdminPaymentById({ params: { id: paymentId } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(detailQuery.populated, [
    ["booking", "bookingId pickup drop bookingMode vehicleType estimatedFare finalFare bookingStatus paymentStatus preferredPickupDate preferredPickupTime createdAt"],
    ["customer", "name phone email"]
  ]);
  assert.equal(res.body.data.payment.customer.id, customerObjectId);
  assert.equal(res.body.data.payment.refundStatus, "pending");
  assert.equal(res.body.data.payment.refundEligible, false);
  assert.equal(res.body.data.payment.booking.pickup.address, "Origin");
});

test("unsupported payment statuses, methods, dates, and invalid IDs return validation errors", async () => {
  for (const queryValue of [
    { status: "processing" },
    { method: "card" },
    { from: "2026-02-30" },
    { from: "2026-11-01", to: "2026-10-01" }
  ]) {
    const res = response();
    await getAdminPayments({ query: queryValue }, res);
    assert.equal(res.statusCode, 400);
  }
  const invalid = response();
  await getAdminPaymentById({ params: { id: "invalid" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("refund controller rejects non-successful and incomplete payments before gateway access", async (t) => {
  const cases = [
    [{ status: "pending", transactionId: "pay_actual", amount: 500, refundAmount: 0 }, 400],
    [{ status: "success", transactionId: "", amount: 500, refundAmount: 0 }, 400],
    [{ status: "success", transactionId: "pay_actual", amount: 500, refundAmount: 50 }, 409],
    [{ status: "success", transactionId: "pay_actual", amount: 500, refundAmount: 0, refundId: "rfnd_existing" }, 409]
  ];
  for (const [payment, expectedStatus] of cases) {
    t.mock.method(Payment, "findById", () => ({
      populate() { return Promise.resolve(payment); }
    }));
    const res = response();
    await refundPayment({ params: { paymentId: paymentId } }, res);
    assert.equal(res.statusCode, expectedStatus);
    t.mock.restoreAll();
  }
});

test("refund controller atomically claims an eligible payment before the gateway request", async (t) => {
  const eligible = {
    status: "success",
    transactionId: "pay_actual",
    amount: 500,
    refundAmount: 0,
    refundId: "",
    refundStatus: null
  };
  t.mock.method(Payment, "findById", () => ({
    populate() { return Promise.resolve(eligible); }
  }));
  let claimFilter;
  t.mock.method(Payment, "findOneAndUpdate", (filter, update, options) => {
    claimFilter = filter;
    assert.deepEqual(update.$set, { refundStatus: "pending", refundInitiatedAt: update.$set.refundInitiatedAt });
    assert.ok(update.$set.refundInitiatedAt instanceof Date);
    assert.deepEqual(options, { new: true });
    return { populate() { return Promise.resolve(null); } };
  });

  const res = response();
  await refundPayment({ params: { paymentId } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(claimFilter.status, "success");
  assert.equal(claimFilter.transactionId, "pay_actual");
  assert.deepEqual(claimFilter.refundId, { $in: ["", null] });
  assert.deepEqual(claimFilter.refundStatus, { $in: ["", null] });
});

test("refund response outcomes persist provider state without overstating pending or failed refunds", async () => {
  const makePayment = () => ({
    status: "success",
    amount: 500,
    refundAmount: 0,
    saves: 0,
    async save() { this.saves += 1; }
  });
  const processed = makePayment();
  const processedResult = await recordRefundResponse(processed, {
    id: "rfnd_processed",
    status: "processed",
    amount: 50000,
    created_at: 1792922400
  });
  assert.equal(processedResult.processed, true);
  assert.equal(processed.status, "refunded");
  assert.equal(processed.refundAmount, 500);
  assert.equal(processed.refundStatus, "processed");
  assert.ok(processed.refundedAt instanceof Date);

  const pending = makePayment();
  const pendingResult = await recordRefundResponse(pending, { id: "rfnd_pending", status: "pending", amount: 50000 });
  assert.equal(pendingResult.refundStatus, "pending");
  assert.equal(pending.status, "success");
  assert.equal(pending.refundAmount, 500);

  const failed = makePayment();
  const failedResult = await recordRefundResponse(failed, { id: "rfnd_failed", status: "failed", amount: 50000 });
  assert.equal(failedResult.refundStatus, "failed");
  assert.equal(failed.status, "success");
  assert.equal(failed.refundAmount, 0);

  const incomplete = makePayment();
  const incompleteResult = await recordRefundResponse(incomplete, { id: "rfnd_unrecognized", status: "queued" });
  assert.equal(incompleteResult.statusCode, 502);
  assert.equal(incomplete.refundStatus, "unknown");
  assert.equal(incomplete.refundId, "rfnd_unrecognized");
  assert.equal(incomplete.saves, 1);
});

test("signed refund webhooks complete pending refunds and preserve failed payment state", async (t) => {
  for (const [eventName, initial, expected] of [
    ["refund.processed", { status: "success", refundStatus: "pending", refundAmount: 500 }, { status: "refunded", refundStatus: "processed", refundAmount: 500 }],
    ["refund.failed", { status: "success", refundStatus: "pending", refundAmount: 500 }, { status: "success", refundStatus: "failed", refundAmount: 0 }]
  ]) {
    const payment = {
      ...initial,
      transactionId: "pay_actual",
      refundId: "rfnd_actual",
      booking: null,
      saved: false,
      async save() { this.saved = true; }
    };
    t.mock.method(Payment, "findOne", async (filter) => {
      assert.deepEqual(filter, { transactionId: "pay_actual", refundId: "rfnd_actual" });
      return payment;
    });
    const body = {
      event: eventName,
      payload: { refund: { entity: { id: "rfnd_actual", payment_id: "pay_actual", amount: 50000, processed_at: 1792922400 } } }
    };
    const rawBody = JSON.stringify(body);
    const signature = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
    const res = {
      statusCode: 200,
      responseText: "",
      status(code) { this.statusCode = code; return this; },
      send(value) { this.responseText = value; return this; }
    };
    await processWebhook({ headers: { "x-razorpay-signature": signature }, rawBody, body }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.responseText, "OK");
    assert.equal(payment.status, expected.status);
    assert.equal(payment.refundStatus, expected.refundStatus);
    assert.equal(payment.refundAmount, expected.refundAmount);
    assert.equal(payment.saved, true);
    t.mock.restoreAll();
  }
});

test("payment and refund states are constrained to the currently implemented workflow", () => {
  assert.deepEqual(Payment.schema.path("status").enumValues, ["pending", "success", "failed", "refunded"]);
  assert.deepEqual(Payment.schema.path("refundStatus").enumValues, ["pending", "processed", "failed", "unknown"]);
  assert.ok(Payment.schema.path("refundInitiatedAt"));
});

test("admin payment routes require protected admin access for list, details, and refunds", () => {
  assert.ok(adminPaymentRoutes.stack.some((layer) => !layer.route && layer.handle.name === "protect"));
  assert.ok(adminPaymentRoutes.stack.some((layer) => !layer.route && layer.handle.name === "adminOnly"));
  const routes = adminPaymentRoutes.stack.filter((layer) => layer.route);
  assert.ok(routes.some((layer) => layer.route.path === "/" && layer.route.methods.get));
  assert.ok(routes.some((layer) => layer.route.path === "/:id" && layer.route.methods.get));
  assert.ok(routes.some((layer) => layer.route.path === "/:paymentId/refund" && layer.route.methods.post));
});
