import React, { useCallback, useEffect, useState, useMemo } from 'react';
import systemSettingService from '../services/systemSettingService';
import {
  Zap,
  Car,
  Truck,
  Users,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Edit3,
  Trash2,
  Lock,
  Power
} from 'lucide-react';

const PROTECTED_KEYS = [
  'system.maintenanceMode',
  'booking.enabled',
  'service.ev_goods.enabled',
  'service.goods_taxi.enabled',
  'payment.enabled',
  'driver.enabled'
];

export default function Settings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatingKey, setUpdatingKey] = useState(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [modalForm, setModalForm] = useState({
    key: '',
    value: '',
    type: 'boolean',
    category: 'system',
    description: ''
  });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await systemSettingService.getAdminSettings();
      setSettings(response.data?.data?.settings || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load system settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Helper to get a setting object by key
  const getSettingByKey = (key) => {
    return settings.find((s) => s.key === key.toLowerCase());
  };

  // Toggle boolean service setting directly
  const handleToggleService = async (key, defaultCategory = 'system', defaultDescription = '') => {
    const existing = getSettingByKey(key);
    const currentValue = existing ? existing.value === true : false;
    const nextValue = !currentValue;

    setUpdatingKey(key);
    setError('');
    setSuccess('');

    try {
      await systemSettingService.updateSetting(key, {
        key,
        value: nextValue,
        type: 'boolean',
        category: existing?.category || defaultCategory,
        description: existing?.description || defaultDescription
      });
      setSuccess(`Successfully ${nextValue ? 'enabled' : 'disabled'} ${key}`);
      await loadSettings();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update ${key}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  // Delete setting handler
  const handleDeleteSetting = async (key) => {
    if (PROTECTED_KEYS.includes(key)) {
      setError(`Cannot delete protected setting: ${key}`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete setting: "${key}"?`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await systemSettingService.deleteSetting(key);
      setSuccess(`Setting "${key}" deleted.`);
      await loadSettings();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to delete setting ${key}`);
    }
  };

  // Open Edit Modal
  const openEditModal = (setting) => {
    setModalMode('edit');
    setModalForm({
      key: setting.key,
      value: setting.type === 'json' ? JSON.stringify(setting.value, null, 2) : String(setting.value),
      type: setting.type,
      category: setting.category,
      description: setting.description || ''
    });
    setModalError('');
    setModalOpen(true);
  };

  // Open Add Modal
  const openAddModal = () => {
    setModalMode('add');
    setModalForm({
      key: '',
      value: 'true',
      type: 'boolean',
      category: 'system',
      description: ''
    });
    setModalError('');
    setModalOpen(true);
  };

  // Handle Save in Modal
  const handleModalSave = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError('');

    let parsedValue = modalForm.value;
    if (modalForm.type === 'boolean') {
      parsedValue = modalForm.value === 'true' || modalForm.value === true;
    } else if (modalForm.type === 'number') {
      parsedValue = Number(modalForm.value);
      if (isNaN(parsedValue)) {
        setModalError('Value must be a valid number');
        setModalSaving(false);
        return;
      }
    } else if (modalForm.type === 'json') {
      try {
        parsedValue = JSON.parse(modalForm.value);
      } catch (err) {
        setModalError('Value must be valid JSON');
        setModalSaving(false);
        return;
      }
    }

    try {
      await systemSettingService.updateSetting(modalForm.key.toLowerCase(), {
        key: modalForm.key.toLowerCase(),
        value: parsedValue,
        type: modalForm.type,
        category: modalForm.category,
        description: modalForm.description
      });
      setSuccess(`Setting "${modalForm.key}" saved successfully.`);
      setModalOpen(false);
      await loadSettings();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save setting.');
    } finally {
      setModalSaving(false);
    }
  };

  // Filtered settings for table
  const filteredSettings = useMemo(() => {
    return settings.filter((s) => {
      const matchesSearch =
        searchQuery === '' ||
        s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [settings, searchQuery, categoryFilter]);

  // Core Service Definition Cards
  const evGoodsSetting = getSettingByKey('service.ev_goods.enabled');
  const isEvEnabled = evGoodsSetting ? evGoodsSetting.value === true : false;

  const goodsTaxiSetting = getSettingByKey('service.goods_taxi.enabled');
  const isTaxiEnabled = goodsTaxiSetting ? goodsTaxiSetting.value === true : false;

  const bookingSetting = getSettingByKey('booking.enabled');
  const isBookingEnabled = bookingSetting ? bookingSetting.value === true : true;

  const driverSetting = getSettingByKey('driver.enabled');
  const isDriverEnabled = driverSetting ? driverSetting.value === true : true;

  const maintenanceSetting = getSettingByKey('system.maintenancemode');
  const isMaintenanceActive = maintenanceSetting ? maintenanceSetting.value === true : false;

  return (
    <div style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            System & Service Settings
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Centrally manage platform core services, vehicle category activation (EV Goods, Goods Taxi), and system configurations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadSettings}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            Add Custom Setting
          </button>
        </div>
      </div>

      {/* Error / Success Feedback Banners */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', color: '#166534', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* CORE TRANSPORT SERVICES SECTION */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '14px' }}>
          Vehicle Category & Service Controls
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* EV Goods Transport Card */}
          <div className="card" style={{ border: isEvEnabled ? '1px solid #86efac' : '1px solid #e2e8f0', background: isEvEnabled ? '#f0fdf4' : '#ffffff', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: isEvEnabled ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isEvEnabled ? '#16a34a' : '#64748b' }}>
                  <Zap size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>EV Goods Transport</h3>
                  <code style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    service.ev_goods.enabled
                  </code>
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isEvEnabled ? '#bbf7d0' : '#fee2e2',
                color: isEvEnabled ? '#15803d' : '#b91c1c'
              }}>
                {isEvEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', minHeight: '38px' }}>
              Controls whether electric cargo loaders, e-rickshaws, and mini cargo carriers can be registered by agencies, booked by customers, and dispatched to drivers.
            </p>
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Allowed Types:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>electric-cargo-loader</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>electric-goods-e-rickshaw</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>electric-mini-cargo-carrier</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>Service Activation:</span>
              <button
                type="button"
                onClick={() => handleToggleService('service.ev_goods.enabled', 'system', 'Enable or disable EV Goods transport services')}
                disabled={updatingKey === 'service.ev_goods.enabled'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: isEvEnabled ? '#dc2626' : '#16a34a',
                  color: '#ffffff'
                }}
              >
                <Power size={14} />
                {updatingKey === 'service.ev_goods.enabled' ? 'Updating...' : isEvEnabled ? 'Disable Service' : 'Enable Service'}
              </button>
            </div>
          </div>

          {/* Goods Taxi Transport Card */}
          <div className="card" style={{ border: isTaxiEnabled ? '1px solid #93c5fd' : '1px solid #e2e8f0', background: isTaxiEnabled ? '#eff6ff' : '#ffffff', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: isTaxiEnabled ? '#dbeafe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isTaxiEnabled ? '#2563eb' : '#64748b' }}>
                  <Car size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Goods Taxi Transport</h3>
                  <code style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    service.goods_taxi.enabled
                  </code>
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isTaxiEnabled ? '#bfdbfe' : '#fee2e2',
                color: isTaxiEnabled ? '#1d4ed8' : '#b91c1c'
              }}>
                {isTaxiEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', minHeight: '38px' }}>
              Controls whether Tata Ace, Mini Pickup, Cargo Pickup, and Goods Loading Taxis can be registered by agencies and booked by customers.
            </p>
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Allowed Types:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>tata-ace</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>mini-pickup</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>cargo-pickup</span>
                <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>goods-loading-taxi</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>Service Activation:</span>
              <button
                type="button"
                onClick={() => handleToggleService('service.goods_taxi.enabled', 'system', 'Enable or disable Goods Taxi transport services')}
                disabled={updatingKey === 'service.goods_taxi.enabled'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: isTaxiEnabled ? '#dc2626' : '#2563eb',
                  color: '#ffffff'
                }}
              >
                <Power size={14} />
                {updatingKey === 'service.goods_taxi.enabled' ? 'Updating...' : isTaxiEnabled ? 'Disable Service' : 'Enable Service'}
              </button>
            </div>
          </div>

          {/* Truck Booking System Card */}
          <div className="card" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Truck Transport (Core)</h3>
                  <code style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    booking.enabled
                  </code>
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isBookingEnabled ? '#bbf7d0' : '#fee2e2',
                color: isBookingEnabled ? '#15803d' : '#b91c1c'
              }}>
                {isBookingEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', minHeight: '38px' }}>
              Controls overall platform booking dispatch for standard commercial trucks (Mini Truck, Pickup, Small/Medium/Large Trucks).
            </p>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Standard Truck Types:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>mini-truck</span>
                <span style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>pickup</span>
                <span style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>medium-truck</span>
                <span style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>large-truck</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>Booking System:</span>
              <button
                type="button"
                onClick={() => handleToggleService('booking.enabled', 'booking', 'Platform booking system availability')}
                disabled={updatingKey === 'booking.enabled'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: isBookingEnabled ? '#dc2626' : '#16a34a',
                  color: '#ffffff'
                }}
              >
                <Power size={14} />
                {updatingKey === 'booking.enabled' ? 'Updating...' : isBookingEnabled ? 'Disable Bookings' : 'Enable Bookings'}
              </button>
            </div>
          </div>

          {/* Maintenance Mode Card */}
          <div className="card" style={{ border: isMaintenanceActive ? '1px solid #f87171' : '1px solid #e2e8f0', background: isMaintenanceActive ? '#fff1f2' : '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: isMaintenanceActive ? '#fee2e2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isMaintenanceActive ? '#dc2626' : '#64748b' }}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Maintenance Mode</h3>
                  <code style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    system.maintenanceMode
                  </code>
                </div>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isMaintenanceActive ? '#fecaca' : '#e2e8f0',
                color: isMaintenanceActive ? '#991b1b' : '#475569'
              }}>
                {isMaintenanceActive ? 'Maintenance Active' : 'Normal Operation'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', minHeight: '38px' }}>
              When enabled, non-admin API requests will receive 503 Service Unavailable maintenance message.
            </p>
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontWeight: '600', color: '#334155', marginBottom: '2px' }}>Status:</div>
              <div>{isMaintenanceActive ? 'Platform is restricted to admin users.' : 'Platform is fully accessible to all users.'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>System Lock:</span>
              <button
                type="button"
                onClick={() => {
                  if (!isMaintenanceActive && !window.confirm('Are you sure you want to activate Maintenance Mode? Non-admin users will be temporarily locked out.')) {
                    return;
                  }
                  handleToggleService('system.maintenancemode', 'system', 'System maintenance mode toggle');
                }}
                disabled={updatingKey === 'system.maintenancemode'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  background: isMaintenanceActive ? '#16a34a' : '#dc2626',
                  color: '#ffffff'
                }}
              >
                <Power size={14} />
                {updatingKey === 'system.maintenancemode' ? 'Updating...' : isMaintenanceActive ? 'Deactivate Maintenance' : 'Activate Maintenance'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ALL PERSISTED SYSTEM SETTINGS TABLE */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>All Persisted System Settings ({settings.length})</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Settings persisted in MongoDB and served via <code>GET /api/config/public</code> and admin routes.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search key or description..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px'
                }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff'
              }}
            >
              <option value="all">All Categories</option>
              <option value="system">System</option>
              <option value="booking">Booking</option>
              <option value="fare">Fare</option>
              <option value="payment">Payment</option>
              <option value="driver">Driver</option>
              <option value="customer">Customer</option>
              <option value="notification">Notification</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading settings…</p>
        ) : filteredSettings.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '15px', fontWeight: '500' }}>No matching settings found.</p>
            <p style={{ fontSize: '13px' }}>Click "Add Custom Setting" above to persist a new configuration key.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Key</th>
                  <th style={{ width: '30%' }}>Value</th>
                  <th style={{ width: '10%' }}>Type</th>
                  <th style={{ width: '12%' }}>Category</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSettings.map((setting) => {
                  const isProtected = PROTECTED_KEYS.includes(setting.key);
                  const isBool = setting.type === 'boolean';

                  return (
                    <tr key={setting._id || setting.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{setting.key}</code>
                          {isProtected && <Lock size={12} color="#94a3b8" title="Protected System Key" />}
                        </div>
                        {setting.description && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{setting.description}</div>
                        )}
                      </td>
                      <td>
                        <div style={{
                          maxWidth: '320px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: isBool ? (setting.value ? '#15803d' : '#b91c1c') : '#1e293b'
                        }}>
                          {typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569', fontWeight: '600' }}>
                          {setting.type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569', textTransform: 'capitalize' }}>
                          {setting.category}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: setting.isActive ? '#dcfce7' : '#fee2e2',
                          color: setting.isActive ? '#15803d' : '#b91c1c'
                        }}>
                          {setting.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {isBool && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleToggleService(setting.key, setting.category, setting.description)}
                              disabled={updatingKey === setting.key}
                              title="Toggle boolean value"
                            >
                              <Power size={12} style={{ marginRight: '4px' }} />
                              {setting.value ? 'Off' : 'On'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEditModal(setting)}
                            title="Edit value and details"
                          >
                            <Edit3 size={12} />
                          </button>
                          {!isProtected && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleDeleteSetting(setting.key)}
                              style={{ color: '#dc2626', background: 'transparent', border: '1px solid #fecaca' }}
                              title="Delete setting"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT SETTING */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
                {modalMode === 'add' ? 'Add System Setting' : `Edit Setting: ${modalForm.key}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleModalSave} style={{ padding: '20px 24px' }}>
              {modalError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', color: '#991b1b', marginBottom: '16px', fontSize: '13px' }}>
                  {modalError}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Setting Key *
                </label>
                <input
                  type="text"
                  value={modalForm.key}
                  onChange={(e) => setModalForm({ ...modalForm, key: e.target.value })}
                  placeholder="e.g. service.ev_goods.enabled"
                  disabled={modalMode === 'edit'}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: modalMode === 'edit' ? '#f1f5f9' : '#ffffff'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Lowercase alphanumeric with dots, dashes or underscores.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Type *
                  </label>
                  <select
                    value={modalForm.type}
                    onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="boolean">Boolean (true/false)</option>
                    <option value="number">Number</option>
                    <option value="string">String</option>
                    <option value="json">JSON Object/Array</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    value={modalForm.category}
                    onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="system">System</option>
                    <option value="booking">Booking</option>
                    <option value="fare">Fare</option>
                    <option value="payment">Payment</option>
                    <option value="driver">Driver</option>
                    <option value="customer">Customer</option>
                    <option value="notification">Notification</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Value *
                </label>
                {modalForm.type === 'boolean' ? (
                  <select
                    value={String(modalForm.value)}
                    onChange={(e) => setModalForm({ ...modalForm, value: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="true">True (Enabled / Active)</option>
                    <option value="false">False (Disabled / Inactive)</option>
                  </select>
                ) : modalForm.type === 'json' ? (
                  <textarea
                    rows={4}
                    value={modalForm.value}
                    onChange={(e) => setModalForm({ ...modalForm, value: e.target.value })}
                    placeholder='{"key": "value"} or ["item1", "item2"]'
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                ) : (
                  <input
                    type={modalForm.type === 'number' ? 'number' : 'text'}
                    value={modalForm.value}
                    onChange={(e) => setModalForm({ ...modalForm, value: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                  placeholder="Explain the purpose of this setting"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={modalSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSaving}
                >
                  {modalSaving ? 'Saving...' : 'Save Setting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
