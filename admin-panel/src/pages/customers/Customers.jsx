import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowUp, CalendarDays, CheckCircle2, CircleUserRound,
  Clock3, RefreshCw, Search, ShieldCheck, UserRound, Users, XCircle
} from 'lucide-react';
import customerService from '../../services/customerService';
import './customerDashboard.css';

const initialFilters = { search: '', isActive: '', hasBookings: '', recentlyRegistered: '', from: '', to: '' };
const sortFields = [
  { value: 'createdAt:desc', label: 'Newest registered' },
  { value: 'createdAt:asc', label: 'Oldest registered' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'lastLoginAt:desc', label: 'Recent login' },
  { value: 'lastLoginAt:asc', label: 'Oldest login' }
];

const dateLabel = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
};

const initials = (name) => String(name || 'Customer')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0] || '')
  .join('')
  .toUpperCase();

function CustomerAvatar({ customer, size = 'normal' }) {
  return customer.profileImage ? (
    <img className={`customer-avatar customer-avatar-${size}`} src={customer.profileImage} alt="" />
  ) : (
    <span className={`customer-avatar customer-avatar-${size} customer-avatar-fallback`} aria-label={`${customer.name || 'Customer'} avatar`}>
      {initials(customer.name)}
    </span>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, ...sort };
      Object.entries(filters).forEach(([key, value]) => { if (value) params[key] = value; });
      const response = await customerService.getCustomers(params);
      const data = response.data?.data;
      if (!Array.isArray(data?.customers) || !data?.pagination || !data?.stats) {
        throw new Error('The customer API returned an unexpected response.');
      }
      setCustomers(data.customers);
      setStats(data.stats);
      setPagination(data.pagination);
      return true;
    } catch (requestError) {
      setCustomers([]);
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load customers.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page, sort]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const applyFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'from' || key === 'to' ? { recentlyRegistered: '' } : {}),
      ...(key === 'recentlyRegistered' && value === 'true' ? { from: '', to: '' } : {})
    }));
    setPage(1);
  };

  const applySummaryFilter = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchText('');
    setSort({ sortBy: 'createdAt', sortOrder: 'desc' });
    setPage(1);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    applyFilter('search', searchText.trim());
  };

  const toggleStatus = async (customer) => {
    const nextActive = !customer.isActive;
    const newStatus = nextActive ? 'Active' : 'Inactive';
    if (!window.confirm(`Change ${customer.name || 'this customer'} from ${customer.isActive ? 'Active' : 'Inactive'} to ${newStatus}?`)) return;
    setError('');
    setNotice('');
    try {
      await customerService.updateStatus(customer.id, nextActive);
      if (!(await loadCustomers())) return;
      setNotice(`${customer.name || 'Customer'} is now ${newStatus.toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update account status.');
    }
  };

  const summary = [
    { label: 'Total customers', value: stats?.total, icon: Users, tone: 'blue', onClick: clearFilters },
    { label: 'Active', value: stats?.active, icon: CheckCircle2, tone: 'green', onClick: () => applySummaryFilter({ isActive: 'true' }) },
    { label: 'Inactive', value: stats?.inactive, icon: XCircle, tone: 'rose', onClick: () => applySummaryFilter({ isActive: 'false' }) },
    { label: 'Registered · 30 days', value: stats?.recentlyRegistered, icon: Clock3, tone: 'violet', onClick: () => applySummaryFilter({ recentlyRegistered: 'true', from: '', to: '' }) },
    { label: 'With bookings', value: stats?.withBookings, icon: Activity, tone: 'cyan', onClick: () => applySummaryFilter({ hasBookings: 'true' }) },
    { label: 'Without bookings', value: stats?.withoutBookings, icon: CircleUserRound, tone: 'amber', onClick: () => applySummaryFilter({ hasBookings: 'false' }) }
  ];

  return (
    <main className="customer-page">
      <header className="customer-page-header">
        <div>
          <span className="customer-eyebrow">CUSTOMER OPERATIONS</span>
          <h1>Customer management</h1>
          <p>Review customer accounts and their platform activity.</p>
        </div>
        <button className="customer-button customer-button-secondary" type="button" onClick={loadCustomers} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'customer-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="customer-summary-grid" aria-label="Customer statistics">
        {summary.map(({ label, value, icon: Icon, tone, onClick }) => (
          <button type="button" className={`customer-summary-card customer-summary-${tone}`} key={label} onClick={onClick}>
            <span className="customer-summary-icon"><Icon size={18} /></span>
            <span className="customer-summary-label">{label}</span>
            <strong>{stats ? Number(value ?? 0).toLocaleString('en-IN') : '—'}</strong>
          </button>
        ))}
      </section>

      <section className="customer-panel">
        <div className="customer-panel-heading">
          <div>
            <h2>Customers <span>{pagination.total.toLocaleString('en-IN')}</span></h2>
            <p>Only accounts with the customer role are included.</p>
          </div>
          <button className="customer-text-button" type="button" onClick={clearFilters}>Clear filters</button>
        </div>

        <form className="customer-search-form" onSubmit={submitSearch}>
          <label className="customer-search-box">
            <Search size={18} />
            <input aria-label="Search customers" placeholder="Name, email, phone, or customer ID" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          </label>
          <button className="customer-button customer-button-primary" type="submit" disabled={loading}>Search</button>
        </form>

        <div className="customer-filter-grid">
          <label>Account status
            <select value={filters.isActive} onChange={(event) => applyFilter('isActive', event.target.value)}>
              <option value="">All customers</option><option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </label>
          <label>Booking activity
            <select value={filters.hasBookings} onChange={(event) => applyFilter('hasBookings', event.target.value)}>
              <option value="">All booking activity</option><option value="true">With bookings</option><option value="false">Without bookings</option>
            </select>
          </label>
          <label>Registration period
            <select value={filters.recentlyRegistered} onChange={(event) => applyFilter('recentlyRegistered', event.target.value)}>
              <option value="">Any date</option><option value="true">Last 30 days</option>
            </select>
          </label>
          <label><span><CalendarDays size={14} /> Registered from</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => applyFilter('from', event.target.value)} />
          </label>
          <label><span><CalendarDays size={14} /> Registered to</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => applyFilter('to', event.target.value)} />
          </label>
          <label>Sort customers
            <select value={`${sort.sortBy}:${sort.sortOrder}`} onChange={(event) => {
              const [sortBy, sortOrder] = event.target.value.split(':');
              setSort({ sortBy, sortOrder });
              setPage(1);
            }}>
              {sortFields.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="customer-alert" role="alert"><XCircle size={18} /><span>{error}</span><button type="button" onClick={loadCustomers}>Retry</button></div>}
        {notice && <div className="customer-notice" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}

        <div className="customer-table-toolbar">
          <span>{loading ? 'Loading customer records…' : `Showing ${customers.length ? ((page - 1) * limit) + 1 : 0}–${Math.min(page * limit, pagination.total)} of ${pagination.total}`}</span>
          <label>Rows
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="customer-skeleton-list" role="status" aria-label="Loading customer records">
            {[1, 2, 3, 4, 5].map((item) => <div className="customer-skeleton-row" key={item}><span /><div><i /><i /></div><i /><i /><i /></div>)}
          </div>
        ) : error ? null : customers.length ? (
          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead><tr><th>Customer</th><th>Contact</th><th>Bookings</th><th>Joined</th><th>Last login</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-identity">
                        <CustomerAvatar customer={customer} />
                        <div>
                          <button type="button" className="customer-name-link" onClick={() => navigate(`/customers/${customer.id}`)}>{customer.name || 'Name unavailable'}</button>
                          <span>ID · {customer.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="customer-contact-cell">
                      <span title={customer.email || ''}>{customer.email || 'Email unavailable'}</span>
                      <span>{customer.phone || 'Phone unavailable'}</span>
                    </td>
                    <td><span className="customer-booking-count">{Number(customer.bookingCount || 0).toLocaleString('en-IN')}</span></td>
                    <td>{dateLabel(customer.createdAt)}</td>
                    <td>{dateLabel(customer.lastLoginAt)}</td>
                    <td><span className={`customer-status-badge ${customer.isActive ? 'is-active' : 'is-inactive'}`}>{customer.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="customer-row-actions">
                        <button className="customer-row-action" type="button" onClick={() => navigate(`/customers/${customer.id}`)}>Details</button>
                        <button className="customer-row-action customer-row-action-status" type="button" onClick={() => toggleStatus(customer)}>{customer.isActive ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="customer-state">
            <UserRound size={28} /><strong>No customers found</strong><span>Try changing your search or filters.</span>
            <button type="button" className="customer-button customer-button-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        )}

        <footer className="customer-pagination">
          <span>Page {page} of {Math.max(pagination.totalPages, 1)}</span>
          <div>
            <button className="customer-button customer-button-secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowDown className="customer-rotate-up" size={14} /> Previous</button>
            <button className="customer-button customer-button-secondary" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}>Next <ArrowUp className="customer-rotate-down" size={14} /></button>
          </div>
        </footer>
      </section>
    </main>
  );
}
