export const bookingFilters = [
  { id: 'all', label: 'All' },
  { id: 'unassigned', label: 'Needs Assignment' },
  { id: 'awaiting', label: 'Awaiting Driver' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' }
];

export const normalizeAgencyBookingsResponse = (response) => {
  const body = response?.data;
  const data = body?.data;

  if (body?.success !== true) {
    throw new Error(body?.message || 'Agency bookings request was not successful.');
  }
  if (!Array.isArray(data?.bookings)) {
    throw new Error('Agency bookings response is missing the expected data.bookings array.');
  }
  const pagination = data.pagination;
  const total = Number(pagination?.total);
  const returned = Number(pagination?.returned);
  const page = Number(pagination?.page);
  const limit = Number(pagination?.limit);
  const pages = Number(pagination?.pages);
  if (
    !Number.isInteger(total) || total < 0 ||
    !Number.isInteger(returned) || returned !== data.bookings.length ||
    !Number.isInteger(page) || page < 1 ||
    !Number.isInteger(limit) || limit < 1 ||
    !Number.isInteger(pages) || pages !== Math.ceil(total / limit) ||
    data.bookings.length > limit
  ) {
    throw new Error('Agency bookings response contains invalid pagination metadata.');
  }

  return {
    bookings: data.bookings,
    pagination: { total, returned, page, limit, pages }
  };
};

export const loadAllAgencyBookingPages = async (fetchPage, pageSize = 100) => {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('Agency booking page size must be a positive integer.');
  }
  const firstPage = normalizeAgencyBookingsResponse(await fetchPage(1, pageSize));
  if (firstPage.pagination.page !== 1 || firstPage.pagination.limit !== pageSize) {
    throw new Error('Agency bookings response did not match the requested page size.');
  }
  const bookings = [...firstPage.bookings];
  const pages = Math.ceil(firstPage.pagination.total / pageSize);

  for (let page = 2; page <= pages; page += 1) {
    const pageData = normalizeAgencyBookingsResponse(await fetchPage(page, pageSize));
    if (pageData.pagination.total !== firstPage.pagination.total) {
      throw new Error('Agency booking count changed while loading pages. Refresh to load a consistent list.');
    }
    if (pageData.pagination.page !== page || pageData.pagination.limit !== pageSize) {
      throw new Error(`Agency bookings page ${page} did not match the requested pagination.`);
    }
    if (pageData.bookings.length === 0) {
      throw new Error(`Agency bookings page ${page} was empty before all ${firstPage.pagination.total} records were loaded.`);
    }
    bookings.push(...pageData.bookings);
  }

  if (bookings.length !== firstPage.pagination.total) {
    throw new Error(`Loaded ${bookings.length} of ${firstPage.pagination.total} agency bookings. Refresh to retry.`);
  }

  return {
    bookings,
    pagination: {
      total: firstPage.pagination.total,
      returned: bookings.length,
      page: 1,
      limit: pageSize,
      pages
    }
  };
};

const isNeedsAssignment = (booking) =>
  booking.bookingStatus === 'pending' &&
  !booking.driver &&
  ['unassigned', 'rejected', undefined, null].includes(booking.assignmentStatus);

const isAwaitingDriver = (booking) =>
  booking.assignmentStatus === 'pending_acceptance' ||
  (booking.bookingStatus === 'pending' && Boolean(booking.driver));

export const matchesBookingFilter = (booking, filter) => {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return isNeedsAssignment(booking);
  if (filter === 'awaiting') return isAwaitingDriver(booking);
  if (filter === 'accepted') {
    return booking.bookingStatus === 'accepted' ||
      (booking.bookingStatus === 'pending' && booking.assignmentStatus === 'accepted');
  }
  if (filter === 'rejected') {
    return booking.bookingStatus === 'rejected' || booking.assignmentStatus === 'rejected';
  }
  if (filter === 'in_progress') return booking.bookingStatus === 'in-progress';
  if (filter === 'completed') return booking.bookingStatus === 'completed';
  if (filter === 'cancelled') return booking.bookingStatus === 'cancelled';
  return false;
};

export const getBookingFilterCounts = (bookings) =>
  bookingFilters.reduce((counts, filter) => {
    counts[filter.id] = bookings.filter((booking) => matchesBookingFilter(booking, filter.id)).length;
    return counts;
  }, {});

export const filterAgencyBookings = (bookings, searchQuery, statusFilter) => {
  const query = searchQuery.trim().toLocaleLowerCase();
  return bookings.filter((booking) => {
    const searchableFields = [
      booking.bookingId,
      booking._id,
      booking.customer?.name,
      booking.customer?.phone,
      booking.pickup?.address,
      booking.drop?.address
    ];
    const matchesSearch = !query || searchableFields.some((value) =>
      String(value || '').toLocaleLowerCase().includes(query)
    );
    return matchesSearch && matchesBookingFilter(booking, statusFilter);
  });
};
