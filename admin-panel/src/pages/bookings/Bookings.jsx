import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CalendarDays, CheckCircle2, CircleCheck, CircleX, Clock3,
  ClipboardList, RefreshCw, Search, Truck, XCircle
} from 'lucide-react';
import bookingService from '../../services/bookingService';
import { AssignmentStatusBadge, BookingStatusBadge } from './BookingBadges';
import { formatMoney, formatTimestamp, titleCase } from './bookingDisplay';
import './bookingDashboard.css';

const initialFilters = {
  search: '',
  bookingStatus: '',
  assignmentStatus: '',
  bookingMode: '',
  vehicleType: '',
  paymentStatus: '',
  from: '',
  to: ''
};

const statusFilters = [
  { label: 'All bookings', filters: {} },
  { label: 'Pending agency', filters: { bookingStatus: 'pending', assignmentStatus: 'unassigned' } },
  { label: 'Awaiting driver', filters: { assignmentStatus: 'pending_acceptance' } },
  { label: 'Driver rejected', filters: { assignmentStatus: 'rejected' } },
  { label: 'Driver accepted', filters: { bookingStatus: 'accepted' } },
  { label: 'In progress', filters: { bookingStatus: 'in-progress' } },
  { label: 'Completed', filters: { bookingStatus: 'completed' } },
  { label: 'Cancelled', filters: { bookingStatus: 'cancelled' } }
];

const summaryConfig = [
  { key: 'total', label: 'Total bookings', icon: ClipboardList, color: 'blue' },
  { key: 'pendingAgencyAssignment', label: 'Pending agency', icon: AlertCircle, color: 'amber', filters: { bookingStatus: 'pending', assignmentStatus: 'unassigned' } },
  { key: 'awaitingDriverAcceptance', label: 'Awaiting driver', icon: Clock3, color: 'violet', filters: { assignmentStatus: 'pending_acceptance' } },
  { key: 'driverAccepted', label: 'Driver accepted', icon: CheckCircle2, color: 'green', filters: { bookingStatus: 'accepted' } },
  { key: 'inProgress', label: 'In progress', icon: Truck, color: 'cyan', filters: { bookingStatus: 'in-progress' } },
  { key: 'completed', label: 'Completed', icon: CircleCheck, color: 'green', filters: { bookingStatus: 'completed' } },
  { key: 'cancelled', label: 'Cancelled', icon: CircleX, color: 'rose', filters: { bookingStatus: 'cancelled' } }
];

const activeStatusFilter = (filters) => statusFilters.find(({ filters: status }) =>
  Object.keys(status).length
    ? Object.entries(status).every(([key, value]) => filters[key] === value)
      && !Object.keys(filters).some((key) => ['bookingStatus', 'assignmentStatus'].includes(key) && filters[key] && status[key] !== filters[key])
    : !filters.bookingStatus && !filters.assignmentStatus
);

function BookingTable({ bookings, onOpen }) {
  return (
    <div className="booking-table-scroll">
      <table className="booking-table">
        <thead>
          <tr>
            <th>Booking reference</th>
            <th>Customer</th>
            <th>Route</th>
            <th>Service</th>
            <th>Agency</th>
            <th>Driver</th>
            <th>Fare</th>
            <th>Payment</th>
            <th>Booking status</th>
            <th>Assignment</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking._id}>
              <td>
                <button className="booking-reference-link" type="button" onClick={() => onOpen(booking)}>
                  {booking.bookingId || 'Booking'}
                </button>
                <span className="booking-cell-subtext">{formatTimestamp(booking.createdAt)}</span>
              </td>
              <td>
                <strong>{booking.customer?.name || 'Customer unavailable'}</strong>
                <span className="booking-cell-subtext">{booking.customer?.phone || '—'}</span>
              </td>
              <td className="booking-route-cell">
                <span title={booking.pickup?.address}>{booking.pickup?.address || 'Pickup unavailable'}</span>
                <span className="booking-route-arrow">↓</span>
                <span title={booking.drop?.address}>{booking.drop?.address || 'Drop-off unavailable'}</span>
              </td>
              <td>
                <strong>{titleCase(booking.vehicleType)}</strong>
                <span className="booking-cell-subtext">{titleCase(booking.bookingMode)}</span>
              </td>
              <td>{booking.agency?.agencyName || 'Not assigned'}</td>
              <td>
                <strong>{booking.driver?.fullName || 'Unassigned'}</strong>
                {booking.driver?.phone && <span className="booking-cell-subtext">{booking.driver.phone}</span>}
              </td>
              <td>
                <strong>{formatMoney(booking.finalFare)}</strong>
                <span className="booking-cell-subtext">Est. {formatMoney(booking.estimatedFare)}</span>
              </td>
              <td><span className={`booking-payment booking-payment-${booking.paymentStatus || 'unknown'}`}>{titleCase(booking.paymentStatus)}</span></td>
              <td><BookingStatusBadge booking={booking} /></td>
              <td><AssignmentStatusBadge status={booking.assignmentStatus} /></td>
              <td><button className="booking-row-action" type="button" onClick={() => onOpen(booking)}>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, sortBy, sortOrder };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const response = await bookingService.getBookings(params);
      const data = response.data?.data;
      if (!Array.isArray(data?.bookings) || !data?.stats || !Number.isInteger(data?.total)) {
        throw new Error('The bookings API returned an unexpected response.');
      }
      setBookings(data.bookings);
      setStats(data.stats);
      setPagination({ total: data.total, pages: data.pages || 1 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load bookings.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page, sortBy, sortOrder]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const changeFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const selectStatusFilter = (filter) => {
    setFilters((current) => ({
      ...current,
      bookingStatus: filter.filters.bookingStatus || '',
      assignmentStatus: filter.filters.assignmentStatus || ''
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchText('');
    setPage(1);
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    changeFilter('search', searchText.trim());
  };

  const statusFilter = activeStatusFilter(filters);

  return (
    <main className="booking-page">
      <header className="booking-page-header">
        <div>
          <span className="booking-eyebrow">OPERATIONS / FLEET TRIPS</span>
          <h1>Booking management</h1>
          <p>Monitor assignments, trip progress, and payments across the platform.</p>
        </div>
        <button className="booking-button booking-button-secondary" type="button" onClick={loadBookings} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'booking-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="booking-summary-grid" aria-label="Booking totals">
        {summaryConfig.map(({ key, label, icon: Icon, color, filters: cardFilters }) => (
          <button
            type="button"
            className={`booking-summary-card booking-summary-${color}`}
            key={key}
            onClick={() => {
              if (!cardFilters) clearFilters();
              else selectStatusFilter({ filters: cardFilters });
            }}
          >
            <span className="booking-summary-icon"><Icon size={18} /></span>
            <span className="booking-summary-label">{label}</span>
            <strong>{stats ? stats[key] : '—'}</strong>
          </button>
        ))}
      </section>

      <section className="booking-panel">
        <div className="booking-panel-heading">
          <div>
            <h2>All bookings <span>{pagination.total.toLocaleString('en-IN')}</span></h2>
            <p>Search and filter live booking records. This view is read-only.</p>
          </div>
          <button className="booking-text-button" type="button" onClick={clearFilters}>Clear filters</button>
        </div>

        <form className="booking-search-form" onSubmit={submitSearch}>
          <label className="booking-search-box">
            <Search size={18} />
            <input
              aria-label="Search bookings"
              placeholder="Reference, customer, agency, driver, vehicle or route"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
          <button className="booking-button booking-button-primary" type="submit" disabled={loading}>Search bookings</button>
        </form>

        <div className="booking-status-filter-row" role="group" aria-label="Filter bookings by status">
          {statusFilters.map((filter) => (
            <button
              type="button"
              key={filter.label}
              className={`booking-filter-chip ${statusFilter?.label === filter.label ? 'is-active' : ''}`}
              onClick={() => selectStatusFilter(filter)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="booking-filter-grid">
          <label>Booking mode
            <select value={filters.bookingMode} onChange={(event) => changeFilter('bookingMode', event.target.value)}>
              <option value="">All modes</option><option value="instant">Instant</option><option value="scheduled">Scheduled</option>
            </select>
          </label>
          <label>Vehicle category
            <select value={filters.vehicleType} onChange={(event) => changeFilter('vehicleType', event.target.value)}>
              <option value="">All categories</option>
              {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </label>
          <label>Payment status
            <select value={filters.paymentStatus} onChange={(event) => changeFilter('paymentStatus', event.target.value)}>
              <option value="">All payments</option>
              {['pending', 'paid', 'failed', 'refunded', 'cash'].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <label><span><CalendarDays size={14} /> Created from</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => changeFilter('from', event.target.value)} />
          </label>
          <label><span><CalendarDays size={14} /> Created to</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => changeFilter('to', event.target.value)} />
          </label>
          <label>Sort by
            <select value={`${sortBy}:${sortOrder}`} onChange={(event) => {
              const [nextSortBy, nextSortOrder] = event.target.value.split(':');
              setSortBy(nextSortBy);
              setSortOrder(nextSortOrder);
              setPage(1);
            }}>
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="preferredPickupDate:asc">Pickup date: earliest</option>
              <option value="preferredPickupDate:desc">Pickup date: latest</option>
              <option value="estimatedFare:desc">Estimated fare: high to low</option>
              <option value="estimatedFare:asc">Estimated fare: low to high</option>
              <option value="bookingId:asc">Reference: A–Z</option>
            </select>
          </label>
        </div>

        {error && <div className="booking-alert" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={loadBookings}>Retry</button></div>}

        <div className="booking-table-toolbar">
          <span>{loading ? 'Loading records…' : `Showing ${bookings.length ? ((page - 1) * limit) + 1 : 0}–${Math.min(page * limit, pagination.total)} of ${pagination.total}`}</span>
          <label>Rows
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
        {loading ? (
          <div className="booking-state"><span className="booking-loader" />Loading bookings…</div>
        ) : error ? null : bookings.length ? (
          <BookingTable bookings={bookings} onOpen={(booking) => navigate(`/bookings/${booking._id}`)} />
        ) : (
          <div className="booking-state">
            <ClipboardList size={28} />
            <strong>No bookings found</strong>
            <span>Try changing your search or filters.</span>
            <button className="booking-button booking-button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        )}

        <footer className="booking-pagination">
          <span>Page {page} of {Math.max(pagination.pages, 1)}</span>
          <div>
            <button className="booking-button booking-button-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
            <button className="booking-button booking-button-secondary" type="button" onClick={() => setPage((current) => Math.min(pagination.pages || 1, current + 1))} disabled={page >= pagination.pages || loading}>Next</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
