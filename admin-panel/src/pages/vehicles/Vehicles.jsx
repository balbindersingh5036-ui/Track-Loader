import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CarFront, RefreshCw, Search } from 'lucide-react';
import vehicleService from '../../services/vehicleService';
import './vehicles.css';

const initialFilters = {
  search: '',
  status: '',
  assigned: '',
  vehicleType: '',
  registrationStatus: '',
  insuranceStatus: '',
  availability: '',
  documentStatus: ''
};

const photoList = (vehicle) => {
  const photos = Array.isArray(vehicle?.vehicleImages)
    ? vehicle.vehicleImages.filter((photo) => typeof photo === 'string' && photo)
    : [];
  return (photos.length ? photos : (vehicle?.vehicleImage ? [vehicle.vehicleImage] : [])).slice(0, 4);
};

const statusLabel = (status) => ({
  not_uploaded: 'Missing',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
}[status || 'not_uploaded'] || status);

function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`vehicle-status vehicle-status-${tone}`}>{children}</span>;
}

function VehiclePhoto({ vehicle }) {
  const [failed, setFailed] = useState(false);
  const photo = photoList(vehicle)[0];
  if (!photo || failed) {
    return <span className="vehicle-photo-placeholder"><CarFront size={22} />No photo</span>;
  }
  return <img className="vehicle-photo-thumb" src={photo} alt={`${vehicle.vehicleNumber} vehicle`} onError={() => setFailed(true)} />;
}

export default function Vehicles() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortOrder: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadVehicles = useCallback(async (page, nextFilters = filters, nextSort = sort, limit = pagination.limit) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, ...nextSort };
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const response = await vehicleService.getVehicles(params);
      const data = response.data?.data;
      if (!Array.isArray(data?.vehicles) || !data?.pagination || !data?.stats) {
        throw new Error('The vehicle API returned an unexpected response.');
      }
      setVehicles(data.vehicles);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load vehicles.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, sort]);

  useEffect(() => {
    loadVehicles(1, filters, sort, pagination.limit);
  }, [filters, sort, pagination.limit, loadVehicles]);

  const applyFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const submitSearch = (event) => {
    event.preventDefault();
    applyFilter('search', searchText.trim());
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchText('');
    setSort({ sortBy: 'createdAt', sortOrder: 'desc' });
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const toggleSort = (sortBy) => {
    setSort((current) => ({
      sortBy,
      sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const toggleActive = async (vehicle) => {
    const nextActive = !vehicle.isActive;
    const action = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${vehicle.vehicleNumber}?`)) return;
    setError('');
    setNotice('');
    try {
      await vehicleService.updateVehicleStatus(vehicle._id, nextActive);
      await loadVehicles(pagination.page);
      setNotice(`${vehicle.vehicleNumber} ${nextActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || `Unable to ${action} vehicle.`);
    }
  };

  const summaryCards = [
    { label: 'Total Vehicles', value: stats?.total ?? '—', onClick: clearFilters },
    { label: 'Active', value: stats?.active ?? '—', onClick: () => applyFilter('status', 'active') },
    { label: 'Inactive', value: stats?.inactive ?? '—', onClick: () => applyFilter('status', 'inactive') },
    { label: 'Available', value: stats?.available ?? '—', onClick: () => applyFilter('availability', 'true') },
    { label: 'Assigned', value: stats?.assigned ?? '—', onClick: () => applyFilter('assigned', 'true') },
    { label: 'Pending RC', value: stats?.pendingRegistration ?? '—', onClick: () => applyFilter('registrationStatus', 'pending') },
    { label: 'Pending Insurance', value: stats?.pendingInsurance ?? '—', onClick: () => applyFilter('insuranceStatus', 'pending') },
    { label: 'Rejected Documents', value: stats?.rejectedDocuments ?? '—', onClick: () => applyFilter('documentStatus', 'rejected') }
  ];

  const sortButton = (label, key) => (
    <button className="vehicle-sort-button" type="button" onClick={() => toggleSort(key)}>
      {label}
      {sort.sortBy === key ? (sort.sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : null}
    </button>
  );

  return (
    <section className="vehicle-page">
      <header className="vehicle-page-header">
        <div>
          <h1>Vehicle Management</h1>
          <p>Review fleet information, vehicle photos, and independent RC and insurance verification.</p>
        </div>
        <button type="button" className="vehicle-secondary-button" onClick={() => loadVehicles(pagination.page)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'vehicle-spin' : ''} /> Refresh
        </button>
      </header>

      <div className="vehicle-summary-grid">
        {summaryCards.map((card) => (
          <button type="button" key={card.label} className="vehicle-summary-card" onClick={card.onClick}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>

      <section className="vehicle-panel">
        <div className="vehicle-panel-heading">
          <div>
            <h2>Fleet vehicles</h2>
            <p>{pagination.total} records · Search, filter, and inspect registered vehicles</p>
          </div>
          <button type="button" className="vehicle-text-button" onClick={clearFilters}>Clear filters</button>
        </div>

        <form className="vehicle-search-form" onSubmit={submitSearch}>
          <label className="vehicle-search-box">
            <Search size={17} />
            <input
              aria-label="Search vehicles"
              placeholder="Registration, model, category, driver, phone, or agency"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
          <button className="vehicle-primary-button" type="submit" disabled={loading}>Search</button>
        </form>

        <div className="vehicle-filter-grid">
          <label>Vehicle status
            <select value={filters.status} onChange={(event) => applyFilter('status', event.target.value)}>
              <option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </label>
          <label>Assignment
            <select value={filters.assigned} onChange={(event) => applyFilter('assigned', event.target.value)}>
              <option value="">All</option><option value="true">Assigned</option><option value="false">Unassigned</option>
            </select>
          </label>
          <label>Category
            <select value={filters.vehicleType} onChange={(event) => applyFilter('vehicleType', event.target.value)}>
              <option value="">All categories</option>
              {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => <option key={type} value={type}>{type.replace('-', ' ')}</option>)}
            </select>
          </label>
          <label>RC status
            <select value={filters.registrationStatus} onChange={(event) => applyFilter('registrationStatus', event.target.value)}>
              <option value="">All</option><option value="missing">Missing</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
          </label>
          <label>Insurance status
            <select value={filters.insuranceStatus} onChange={(event) => applyFilter('insuranceStatus', event.target.value)}>
              <option value="">All</option><option value="missing">Missing</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
          </label>
        </div>

        {error ? <div className="vehicle-error" role="alert"><span>{error}</span><button type="button" onClick={() => loadVehicles(pagination.page)}>Retry</button></div> : null}
        {notice ? <p className="vehicle-notice" role="status">{notice}</p> : null}

        <div className="vehicle-table-wrap">
          <table className="vehicle-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>{sortButton('Registration', 'vehicleNumber')}</th>
                <th>{sortButton('Model', 'vehicleModel')}</th>
                <th>Category</th><th>Agency</th><th>Driver</th><th>RC</th><th>Insurance</th><th>Status</th>
                <th>{sortButton('Created', 'createdAt')}</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }, (_, index) => (
                <tr key={`vehicle-loading-${index}`} aria-hidden="true">
                  {Array.from({ length: 11 }, (_, cell) => <td key={`vehicle-loading-cell-${cell}`}><span className="vehicle-skeleton" /></td>)}
                </tr>
              )) : null}
              {!loading && !error && vehicles.length === 0 ? <tr><td colSpan="11" className="vehicle-table-message">No vehicles match these filters.</td></tr> : null}
              {!loading && !error && vehicles.map((vehicle) => {
                const rc = vehicle.documents?.registration?.status || 'not_uploaded';
                const insurance = vehicle.documents?.insurance?.status || 'not_uploaded';
                const assignedDriver = vehicle.driver;
                return (
                  <tr key={vehicle._id}>
                    <td><VehiclePhoto key={photoList(vehicle)[0] || vehicle._id} vehicle={vehicle} /></td>
                    <td><strong>{vehicle.vehicleNumber}</strong></td>
                    <td>{vehicle.vehicleModel}</td>
                    <td className="vehicle-capitalize">{vehicle.vehicleType?.replace('-', ' ') || '—'}</td>
                    <td>{vehicle.agency?.agencyName || 'Independent'}</td>
                    <td>{assignedDriver ? <>{assignedDriver.fullName || 'Driver'}<small>{assignedDriver.phone || ''}</small></> : 'Unassigned'}</td>
                    <td><StatusBadge tone={rc}>{statusLabel(rc)}</StatusBadge></td>
                    <td><StatusBadge tone={insurance}>{statusLabel(insurance)}</StatusBadge></td>
                    <td><StatusBadge tone={vehicle.isActive ? 'active' : 'inactive'}>{vehicle.isActive ? 'Active' : 'Inactive'}</StatusBadge></td>
                    <td>{vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="vehicle-row-actions">
                        <button type="button" className="vehicle-text-button" onClick={() => navigate(`/vehicles/${vehicle._id}`)}>Details</button>
                        <button type="button" className="vehicle-text-button" onClick={() => toggleActive(vehicle)}>{vehicle.isActive ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="vehicle-pagination">
          <label>Rows per page
            <select value={pagination.limit} onChange={(event) => setPagination((current) => ({ ...current, limit: Number(event.target.value), page: 1 }))}>
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span>{pagination.total ? `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : '0 vehicles'}</span>
          <div>
            <button type="button" className="vehicle-secondary-button" disabled={loading || pagination.page <= 1} onClick={() => loadVehicles(pagination.page - 1)}>Previous</button>
            <button type="button" className="vehicle-secondary-button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => loadVehicles(pagination.page + 1)}>Next</button>
          </div>
        </footer>
      </section>
    </section>
  );
}
