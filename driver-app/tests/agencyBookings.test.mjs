import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterAgencyBookings,
  getBookingFilterCounts,
  loadAllAgencyBookingPages,
  normalizeAgencyBookingsResponse
} from '../src/utils/agencyBookings.mjs';

const response = (bookings, total = bookings.length, page = 1, limit = 100) => ({
  data: {
    success: true,
    message: 'Agency bookings fetched',
    data: {
      bookings,
      pagination: {
        total,
        returned: bookings.length,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }
  }
});

const booking = (id, bookingStatus, assignmentStatus = 'unassigned', extra = {}) => ({
  _id: `booking-${id}`,
  bookingId: `LB-${id}`,
  bookingStatus,
  assignmentStatus,
  ...extra
});

test('agency booking response reads the actual success/data/bookings envelope', () => {
  const record = booking('1', 'pending');
  const normalized = normalizeAgencyBookingsResponse(response([record], 1, 1, 100));
  assert.deepEqual(normalized.bookings, [record]);
  assert.equal(normalized.pagination.total, 1);
});

test('agency booking envelope mismatches are errors, not an empty success state', () => {
  assert.throws(
    () => normalizeAgencyBookingsResponse({ data: { success: true, data: { results: [] } } }),
    /data\.bookings array/
  );
  assert.throws(
    () => normalizeAgencyBookingsResponse({ data: { success: false, message: 'Denied' } }),
    /Denied/
  );
});

test('zero, one, and six booking responses preserve the actual record count', async () => {
  for (const count of [0, 1, 6]) {
    const records = Array.from({ length: count }, (_, index) => booking(index + 1, 'pending'));
    const loaded = await loadAllAgencyBookingPages(async () => response(records, count));
    assert.equal(loaded.bookings.length, count);
    assert.equal(loaded.pagination.total, count);
  }
});

test('agency bookings fetch every page beyond 20 records without truncation', async () => {
  const records = Array.from({ length: 27 }, (_, index) => booking(index + 1, 'pending'));
  const requestedPages = [];
  const loaded = await loadAllAgencyBookingPages(async (page, limit) => {
    requestedPages.push([page, limit]);
    const start = (page - 1) * limit;
    return response(records.slice(start, start + limit), records.length, page, limit);
  }, 10);

  assert.deepEqual(requestedPages, [[1, 10], [2, 10], [3, 10]]);
  assert.equal(loaded.bookings.length, 27);
  assert.equal(loaded.pagination.total, 27);
});

test('agency booking loading reports inconsistent or missing pages', async () => {
  await assert.rejects(
    () => loadAllAgencyBookingPages(async (page) =>
      response(page === 1 ? [booking(1, 'pending')] : [], 2, page, 1), 1),
    /empty before all 2 records/
  );
  await assert.rejects(
    () => loadAllAgencyBookingPages(async (page) =>
      response([booking(page, 'pending')], page === 1 ? 2 : 3, page, 1), 1),
    /count changed while loading/
  );
});

test('booking filter counts use bookingStatus and assignmentStatus for all supported states', () => {
  const records = [
    booking(1, 'pending', 'unassigned'),
    booking(2, 'pending', 'pending_acceptance', { driver: { name: 'Driver' } }),
    booking(3, 'accepted', 'accepted'),
    booking(4, 'pending', 'rejected'),
    booking(5, 'in-progress', 'accepted'),
    booking(6, 'completed', 'accepted'),
    booking(7, 'cancelled', 'unassigned'),
    booking(8, undefined, undefined)
  ];
  const counts = getBookingFilterCounts(records);

  assert.equal(counts.all, 8);
  assert.equal(counts.unassigned, 2);
  assert.equal(counts.awaiting, 1);
  assert.equal(counts.accepted, 1);
  assert.equal(counts.rejected, 1);
  assert.equal(counts.in_progress, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.cancelled, 1);
});

test('booking search combines ID, customer, route, and status filters', () => {
  const records = [
    booking('A123', 'pending', 'unassigned', {
      customer: { name: 'Asha Customer', phone: '5551234' },
      pickup: { address: 'North Depot' },
      drop: { address: 'Central Market' }
    }),
    booking('B456', 'completed', 'accepted', {
      customer: { name: 'Ravi Customer' },
      pickup: { address: 'South Yard' },
      drop: { address: 'Airport' }
    })
  ];

  assert.equal(filterAgencyBookings(records, 'LB-A123', 'all').length, 1);
  assert.equal(filterAgencyBookings(records, 'asha', 'unassigned').length, 1);
  assert.equal(filterAgencyBookings(records, '5551234', 'all').length, 1);
  assert.equal(filterAgencyBookings(records, 'central market', 'all').length, 1);
  assert.equal(filterAgencyBookings(records, 'asha', 'completed').length, 0);
  assert.equal(filterAgencyBookings(records, 'no match', 'all').length, 0);
});
