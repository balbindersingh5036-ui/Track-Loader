import React, { useEffect, useState } from 'react';
import agencyService from '../../services/agencyService';
import { 
  Building2, Users, Car, MapPin, RefreshCw, PlusCircle, 
  UploadCloud, AlertCircle, CheckCircle2, XCircle, Clock, 
  Search, ShieldCheck, Phone, Mail, FileText, ArrowRight,
  ChevronRight, Calendar, Info, Check, Eye
} from 'lucide-react';

export default function AgencyDashboard() {
  const [agency, setAgency] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, drivers, vehicles, bookings, profile

  // Search & filter states
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState('all');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');

  // Form states
  const [newDriver, setNewDriver] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    address: '',
    aadhaarUrl: '',
    dlUrl: ''
  });
  const [newDriverModal, setNewDriverModal] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [docModal, setDocModal] = useState({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '', updating: false });

  const [newVehicle, setNewVehicle] = useState({
    driverId: '',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleType: 'mini-truck',
    loadCapacityValue: 1000,
    loadCapacityUnit: 'kg',
    bodyType: 'open',
    vehicleImage: ''
  });
  const [newVehicleModal, setNewVehicleModal] = useState(false);
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [editVehicleModal, setEditVehicleModal] = useState({
    open: false,
    vehicleId: null,
    vehicleModel: '',
    vehicleType: 'mini-truck',
    loadCapacityValue: 1000,
    loadCapacityUnit: 'kg',
    bodyType: 'open',
    vehicleImage: '',
    isActive: true,
    saving: false
  });
  const [assignModal, setAssignModal] = useState({ open: false, vehicleId: null, driverId: '', assigning: false });
  const [uploadingDoc, setUploadingDoc] = useState('');

  // Profile update form state
  const [profileForm, setProfileForm] = useState({
    agencyName: '',
    address: '',
    city: '',
    saving: false,
    message: ''
  });

  const handleFileUpload = async (e, targetField, setter, purpose = 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDoc(targetField);
      const res = await agencyService.uploadFile(file, purpose);
      const url = res.data?.imageUrl || res.data?.url;
      const publicId = res.data?.publicId || '';
      const resourceType = res.data?.resourceType || 'image';
      const format = res.data?.format || 'pdf';

      setter(prev => ({
        ...prev,
        [targetField]: url,
        [`${targetField}_publicId`]: publicId,
        [`${targetField}_resourceType`]: resourceType,
        [`${targetField}_format`]: format
      }));
    } catch (uploadErr) {
      alert(uploadErr.response?.data?.message || uploadErr.message || 'File upload failed');
    } finally {
      setUploadingDoc('');
    }
  };

  // Registration form (if no agency yet)
  const [regForm, setRegForm] = useState({
    agencyName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    businessRegUrl: '',
    ownerAadhaarUrl: ''
  });
  const [registering, setRegistering] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const agRes = await agencyService.getMyAgency();
        const agencyData = agRes.data.data.agency;
        setAgency(agencyData);
        if (agencyData) {
          setProfileForm({
            agencyName: agencyData.agencyName || '',
            address: agencyData.address || '',
            city: agencyData.city || '',
            saving: false,
            message: ''
          });
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setAgency(null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        throw err;
      }

      const [drRes, vRes, bRes] = await Promise.all([
        agencyService.getAgencyDrivers().catch(() => ({ data: { data: { drivers: [] } } })),
        agencyService.getAgencyVehicles().catch(() => ({ data: { data: { vehicles: [] } } })),
        agencyService.getAgencyBookings().catch(() => ({ data: { data: { bookings: [] } } }))
      ]);

      setDrivers(drRes.data.data.drivers || []);
      setVehicles(vRes.data.data.vehicles || []);
      setBookings(bRes.data.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load agency dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterAgency = async (e) => {
    e.preventDefault();
    try {
      setRegistering(true);
      setError('');
      await agencyService.registerAgency({
        agencyName: regForm.agencyName,
        phone: regForm.phone,
        email: regForm.email,
        address: regForm.address,
        city: regForm.city,
        documents: {
          businessRegistration: {
            url: regForm.businessRegUrl,
            publicId: regForm.businessRegUrl_publicId || '',
            resourceType: regForm.businessRegUrl_resourceType || 'image',
            format: regForm.businessRegUrl_format || 'pdf',
            status: 'pending'
          },
          ownerAadhaar: {
            url: regForm.ownerAadhaarUrl,
            publicId: regForm.ownerAadhaarUrl_publicId || '',
            resourceType: regForm.ownerAadhaarUrl_resourceType || 'image',
            format: regForm.ownerAadhaarUrl_format || 'pdf',
            status: 'pending'
          }
        }
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileForm(prev => ({ ...prev, saving: true, message: '' }));
      const res = await agencyService.updateMyAgency({
        agencyName: profileForm.agencyName,
        address: profileForm.address,
        city: profileForm.city
      });
      setAgency(res.data.data.agency);
      setProfileForm(prev => ({ ...prev, saving: false, message: 'Agency profile updated successfully!' }));
      setTimeout(() => setProfileForm(prev => ({ ...prev, message: '' })), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update profile');
      setProfileForm(prev => ({ ...prev, saving: false }));
    }
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      setCreatingDriver(true);
      const payload = {
        fullName: newDriver.fullName,
        phone: newDriver.phone,
        email: newDriver.email,
        password: newDriver.password,
        address: newDriver.address || '',
        documents: {}
      };

      if (newDriver.aadhaarUrl) {
        payload.documents.idProof = {
          url: newDriver.aadhaarUrl,
          publicId: newDriver.aadhaarUrl_publicId || '',
          resourceType: newDriver.aadhaarUrl_resourceType || 'image',
          format: newDriver.aadhaarUrl_format || 'pdf',
          status: 'pending'
        };
      }
      if (newDriver.dlUrl) {
        payload.documents.drivingLicense = {
          url: newDriver.dlUrl,
          publicId: newDriver.dlUrl_publicId || '',
          resourceType: newDriver.dlUrl_resourceType || 'image',
          format: newDriver.dlUrl_format || 'pdf',
          status: 'pending'
        };
      }

      await agencyService.createAgencyDriver(payload);
      setNewDriver({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        address: '',
        aadhaarUrl: '',
        dlUrl: ''
      });
      setNewDriverModal(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to register driver');
    } finally {
      setCreatingDriver(false);
    }
  };

  const handleUpdateDriverDocs = async (e) => {
    e.preventDefault();
    try {
      setDocModal(prev => ({ ...prev, updating: true }));
      await agencyService.updateDriverDocuments(docModal.driverId, {
        idProof: {
          url: docModal.aadhaarUrl,
          publicId: docModal.aadhaarUrl_publicId || '',
          resourceType: docModal.aadhaarUrl_resourceType || 'image',
          format: docModal.aadhaarUrl_format || 'pdf',
          status: 'pending'
        },
        drivingLicense: {
          url: docModal.dlUrl,
          publicId: docModal.dlUrl_publicId || '',
          resourceType: docModal.dlUrl_resourceType || 'image',
          format: docModal.dlUrl_format || 'pdf',
          status: 'pending'
        }
      });
      setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '', updating: false });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update documents');
      setDocModal(prev => ({ ...prev, updating: false }));
    }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      setCreatingVehicle(true);
      await agencyService.createAgencyVehicle({
        driverId: newVehicle.driverId,
        vehicleNumber: newVehicle.vehicleNumber,
        vehicleModel: newVehicle.vehicleModel,
        vehicleType: newVehicle.vehicleType,
        loadCapacity: { value: Number(newVehicle.loadCapacityValue), unit: newVehicle.loadCapacityUnit },
        bodyType: newVehicle.bodyType,
        vehicleImage: newVehicle.vehicleImage || ''
      });
      setNewVehicle({
        driverId: '',
        vehicleNumber: '',
        vehicleModel: '',
        vehicleType: 'mini-truck',
        loadCapacityValue: 1000,
        loadCapacityUnit: 'kg',
        bodyType: 'open',
        vehicleImage: ''
      });
      setNewVehicleModal(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add vehicle');
    } finally {
      setCreatingVehicle(false);
    }
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    try {
      setEditVehicleModal(prev => ({ ...prev, saving: true }));
      await agencyService.updateAgencyVehicle(editVehicleModal.vehicleId, {
        vehicleModel: editVehicleModal.vehicleModel,
        vehicleType: editVehicleModal.vehicleType,
        loadCapacity: { value: Number(editVehicleModal.loadCapacityValue), unit: editVehicleModal.loadCapacityUnit },
        bodyType: editVehicleModal.bodyType,
        vehicleImage: editVehicleModal.vehicleImage,
        isActive: editVehicleModal.isActive
      });
      setEditVehicleModal({
        open: false,
        vehicleId: null,
        vehicleModel: '',
        vehicleType: 'mini-truck',
        loadCapacityValue: 1000,
        loadCapacityUnit: 'kg',
        bodyType: 'open',
        vehicleImage: '',
        isActive: true,
        saving: false
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update vehicle');
      setEditVehicleModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    try {
      setAssignModal(prev => ({ ...prev, assigning: true }));
      await agencyService.assignVehicleDriver(assignModal.vehicleId, assignModal.driverId);
      setAssignModal({ open: false, vehicleId: null, driverId: '', assigning: false });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to assign driver');
      setAssignModal(prev => ({ ...prev, assigning: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12 }}>
        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Agency Fleet Dashboard...</p>
      </div>
    );
  }

  // If user has not yet registered an agency
  if (!agency) {
    return (
      <section className="card" style={{ maxWidth: 640, margin: '40px auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(22, 119, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Building2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Register Your Transport Agency</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Commercial Fleet Management & Driver Verification</div>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
          Register your transport fleet to manage commercial vehicles and assign verified drivers. Once submitted, your business details and Aadhaar will be reviewed by Super Admin.
        </p>

        {error && <div style={{ color: 'var(--danger)', background: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <form onSubmit={handleRegisterAgency} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Agency Business Name *</label>
            <input
              type="text"
              required
              value={regForm.agencyName}
              onChange={(e) => setRegForm({ ...regForm, agencyName: e.target.value })}
              placeholder="e.g. Speedy Transport Fleet"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Office Phone Number *</label>
              <input
                type="text"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                placeholder="e.g. +919876543210"
              />
            </div>
            <div className="form-group">
              <label>Official Email</label>
              <input
                type="email"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                placeholder="fleet@agency.com"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Office Address</label>
              <input
                type="text"
                value={regForm.address}
                onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                placeholder="e.g. Plot 45, Transport Nagar"
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={regForm.city}
                onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                placeholder="e.g. Ludhiana"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Owner Aadhaar Document (PDF or Image)</label>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              🛡️ <strong>Regulatory Notice:</strong> Please upload a <strong>Masked Aadhaar</strong> (first 8 digits hidden, showing only last 4 digits). Documents are encrypted and accessible only via short-lived authenticated links.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileUpload(e, 'ownerAadhaarUrl', setRegForm, 'aadhaar')}
              />
              {uploadingDoc === 'ownerAadhaarUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading to secure vault…</span>}
            </div>
            <input
              type="url"
              value={regForm.ownerAadhaarUrl}
              onChange={(e) => setRegForm({ ...regForm, ownerAadhaarUrl: e.target.value })}
              placeholder="Or enter secure URL: https://.../owner-aadhaar.pdf"
            />
          </div>

          <div className="form-group">
            <label>Business Registration / Trade Licence Document</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileUpload(e, 'businessRegUrl', setRegForm, 'document')}
              />
              {uploadingDoc === 'businessRegUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
            </div>
            <input
              type="url"
              value={regForm.businessRegUrl}
              onChange={(e) => setRegForm({ ...regForm, businessRegUrl: e.target.value })}
              placeholder="Or enter URL: https://.../business-registration.pdf"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={registering} style={{ marginTop: 8, height: 42 }}>
            {registering ? 'Submitting Registration...' : 'Submit Agency for Super Admin Review'}
          </button>
        </form>
      </section>
    );
  }

  // Filtered views
  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = (d.fullName || d.user?.name || '').toLowerCase().includes(driverSearch.toLowerCase()) ||
      (d.phone || d.user?.phone || '').includes(driverSearch);
    if (driverFilter === 'all') return matchesSearch;
    return matchesSearch && d.approvalStatus === driverFilter;
  });

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = (v.vehicleNumber || '').toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      (v.vehicleModel || '').toLowerCase().includes(vehicleSearch.toLowerCase());
    if (vehicleFilter === 'all') return matchesSearch;
    if (vehicleFilter === 'available') return matchesSearch && v.isAvailable;
    if (vehicleFilter === 'onTrip') return matchesSearch && !v.isAvailable;
    return matchesSearch;
  });

  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === 'all') return true;
    return b.bookingStatus === bookingFilter;
  });

  const approvedDriversCount = drivers.filter(d => d.approvalStatus === 'approved').length;
  const pendingDriversCount = drivers.filter(d => d.approvalStatus === 'pending').length;
  const activeFleetCount = vehicles.filter(v => v.isAvailable).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Agency Dashboard</h1>
            <span className={`badge ${
              agency.approvalStatus === 'approved' ? 'success' :
              agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? 'danger' : 'warning'
            }`}>
              {agency.approvalStatus === 'approved' && <CheckCircle2 size={13} />}
              {agency.approvalStatus === 'pending' && <Clock size={13} />}
              {(agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended') && <XCircle size={13} />}
              {agency.approvalStatus.toUpperCase()}
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {agency.agencyName} &bull; Fleet Management & Operations
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(true)} 
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 2. Compact Verification Status Section */}
      {agency.approvalStatus !== 'approved' && (
        <div style={{
          background: agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#fecaca' : '#fde68a'}`,
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <AlertCircle size={20} color={agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#dc2626' : '#d97706'} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, color: agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#991b1b' : '#92400e' }}>
              Verification Status: {agency.approvalStatus.toUpperCase()}
            </div>
            {agency.approvalStatus === 'pending' && (
              <div style={{ color: '#78350f', marginTop: 2 }}>
                Your agency registration is currently under Super Admin review. You can add drivers and vehicles now; commercial bookings will dispatch once verified.
              </div>
            )}
            {agency.approvalStatus === 'rejected' && (
              <div style={{ color: '#991b1b', marginTop: 2 }}>
                Verification rejected by Super Admin. {agency.rejectionReason ? `Reason: ${agency.rejectionReason}` : 'Please update your verification documents in the Profile tab.'}
              </div>
            )}
            {agency.approvalStatus === 'suspended' && (
              <div style={{ color: '#991b1b', marginTop: 2 }}>
                This agency account is currently suspended. Vehicle assignments and trip dispatches are paused. Please contact support.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Registered Drivers</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(22, 119, 255, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{drivers.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {pendingDriversCount > 0 ? `${pendingDriversCount} pending verification` : 'All drivers processed'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Fleet Vehicles</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{vehicles.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {vehicles.length > 0 ? `${activeFleetCount} available for dispatches` : 'No vehicles registered'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Approved Drivers</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{approvedDriversCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Super Admin approved & active
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Fleet Trips</span>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={18} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1' }}>{bookings.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Commercial client dispatches
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Actions Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setNewDriverModal(true)}
        >
          <PlusCircle size={18} color="var(--primary)" />
          <span>Register Driver</span>
        </button>

        <button
          type="button"
          className="quick-action-btn"
          onClick={() => {
            if (drivers.length === 0) {
              alert('Please register at least one driver before adding a vehicle.');
              setNewDriverModal(true);
            } else {
              setNewVehicleModal(true);
            }
          }}
        >
          <Car size={18} color="#10b981" />
          <span>Add Fleet Vehicle</span>
        </button>

        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setActiveTab('profile')}
        >
          <UploadCloud size={18} color="#f59e0b" />
          <span>Agency KYC & Profile</span>
        </button>

        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setActiveTab('bookings')}
        >
          <MapPin size={18} color="#6366f1" />
          <span>View Fleet Trips</span>
        </button>
      </div>

      {/* 5. Navigation Tabs */}
      <div className="agency-tabs">
        <button
          type="button"
          className={`agency-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Building2 size={16} />
          Overview
        </button>
        <button
          type="button"
          className={`agency-tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          <Users size={16} />
          Drivers ({drivers.length})
        </button>
        <button
          type="button"
          className={`agency-tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicles')}
        >
          <Car size={16} />
          Fleet Vehicles ({vehicles.length})
        </button>
        <button
          type="button"
          className={`agency-tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <MapPin size={16} />
          Fleet Trips ({bookings.length})
        </button>
        <button
          type="button"
          className={`agency-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <FileText size={16} />
          Profile & KYC
        </button>
      </div>

      {/* 6. TAB WORKSPACE */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Recent Drivers & Status */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, margin: 0 }}>Driver Verification Status</h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setActiveTab('drivers')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Manage <ArrowRight size={12} />
                </button>
              </div>

              {drivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)' }}>
                  <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>No drivers registered yet</div>
                  <p style={{ fontSize: 12, margin: '0 0 12px 0' }}>Register drivers under your agency to assign vehicles and receive trips.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewDriverModal(true)}>
                    + Register Driver
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {drivers.slice(0, 4).map(d => (
                    <div key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.fullName || d.user?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.phone || d.user?.phone}</div>
                      </div>
                      <span className={`badge ${
                        d.approvalStatus === 'approved' ? 'success' :
                        d.approvalStatus === 'rejected' ? 'danger' : 'warning'
                      }`}>
                        {d.approvalStatus}
                      </span>
                    </div>
                  ))}
                  {drivers.length > 4 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--primary)', cursor: 'pointer', paddingTop: 4 }} onClick={() => setActiveTab('drivers')}>
                      View all {drivers.length} drivers &rarr;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Fleet Vehicles */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, margin: 0 }}>Fleet Inventory</h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setActiveTab('vehicles')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Manage <ArrowRight size={12} />
                </button>
              </div>

              {vehicles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)' }}>
                  <Car size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>No vehicles added yet</div>
                  <p style={{ fontSize: 12, margin: '0 0 12px 0' }}>Add commercial trucks and assign drivers to enable customer bookings.</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (drivers.length === 0) setNewDriverModal(true);
                      else setNewVehicleModal(true);
                    }}
                  >
                    + Add Fleet Vehicle
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vehicles.slice(0, 4).map(v => (
                    <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {v.vehicleImage ? (
                          <img src={v.vehicleImage} alt={v.vehicleNumber} style={{ width: 36, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                        ) : (
                          <div style={{ width: 36, height: 28, background: '#e5e7eb', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Car size={16} color="#9ca3af" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{v.vehicleNumber}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.vehicleModel} &bull; {v.vehicleType}</div>
                        </div>
                      </div>
                      <span className={`badge ${v.isAvailable ? 'success' : 'default'}`}>
                        {v.isAvailable ? 'Available' : 'On Trip'}
                      </span>
                    </div>
                  ))}
                  {vehicles.length > 4 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--primary)', cursor: 'pointer', paddingTop: 4 }} onClick={() => setActiveTab('vehicles')}>
                      View all {vehicles.length} vehicles &rarr;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Operational Policy & Guidelines Card */}
          <div className="card" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Info size={16} color="var(--primary)" />
              <h3 style={{ fontSize: 14, margin: 0, color: '#1e293b' }}>Agency Operations & Dispatch Protocols</h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              <li><strong>Verification Pre-requisite:</strong> Commercial bookings are dispatched only to vehicles whose assigned driver is approved by Super Admin and currently marked online.</li>
              <li><strong>Autonomous Dispatches:</strong> Customer requests for instant and scheduled freight select available agency vehicles matching the required cargo type.</li>
              <li><strong>Agency Data Boundaries:</strong> All vehicle assignments, driver profiles, and trip records remain strictly isolated to your verified transport agency.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS */}
      {activeTab === 'drivers' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Agency Fleet Drivers</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Manage drivers and submit required KYC documents for Super Admin review.</div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewDriverModal(true)}>
              + Register Driver
            </button>
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', flex: '1', minWidth: 200 }}>
              <Search size={14} color="#9ca3af" style={{ marginRight: 8 }} />
              <input
                type="text"
                placeholder="Search driver by name or phone..."
                value={driverSearch}
                onChange={e => setDriverSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: 13 }}
              />
            </div>
            <select
              value={driverFilter}
              onChange={e => setDriverFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All Verification Statuses</option>
              <option value="pending">Pending Verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {filteredDrivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>
              <Users size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ margin: '0 0 12px 0', fontSize: 13 }}>
                {driverSearch || driverFilter !== 'all' ? 'No drivers match the current filter.' : 'No drivers registered yet.'}
              </p>
              {!driverSearch && driverFilter === 'all' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewDriverModal(true)}>
                  + Register Your First Driver
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Driver Details</th>
                    <th>Contact</th>
                    <th>Admin Approval</th>
                    <th>KYC Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => (
                    <tr key={d._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.fullName || d.user?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {d._id.slice(-6).toUpperCase()}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{d.phone || d.user?.phone}</div>
                        {d.email && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.email}</div>}
                      </td>
                      <td>
                        <span className={`badge ${
                          d.approvalStatus === 'approved' ? 'success' :
                          d.approvalStatus === 'rejected' ? 'danger' : 'warning'
                        }`}>
                          {d.approvalStatus}
                        </span>
                        {d.approvalStatus === 'rejected' && d.rejectionReason && (
                          <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>
                            <strong>Reason:</strong> {d.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div>
                            Aadhaar:{' '}
                            {d.documents?.idProof?.viewUrl || d.documents?.idProof?.url ? (
                              <a
                                href={d.documents.idProof.viewUrl || d.documents.idProof.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#166534', fontWeight: 600 }}
                              >
                                View (Uploaded)
                              </a>
                            ) : (
                              <span style={{ color: '#991b1b' }}>Missing</span>
                            )}
                          </div>
                          <div>
                            Licence:{' '}
                            {d.documents?.drivingLicense?.viewUrl || d.documents?.drivingLicense?.url ? (
                              <a
                                href={d.documents.drivingLicense.viewUrl || d.documents.drivingLicense.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#166534', fontWeight: 600 }}
                              >
                                View (Uploaded)
                              </a>
                            ) : (
                              <span style={{ color: '#991b1b' }}>Missing</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDocModal({
                            open: true,
                            driverId: d._id,
                            aadhaarUrl: d.documents?.idProof?.url || '',
                            dlUrl: d.documents?.drivingLicense?.url || '',
                            updating: false
                          })}
                        >
                          Upload / Update Docs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VEHICLES */}
      {activeTab === 'vehicles' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Fleet Vehicles Inventory</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Commercial trucks registered and assigned to agency drivers.</div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={drivers.length === 0}
              onClick={() => setNewVehicleModal(true)}
            >
              + Add Vehicle
            </button>
          </div>

          {drivers.length === 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef08a', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#92400e', marginBottom: 14 }}>
              * You must register at least one driver before you can add fleet vehicles.
            </div>
          )}

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', flex: '1', minWidth: 200 }}>
              <Search size={14} color="#9ca3af" style={{ marginRight: 8 }} />
              <input
                type="text"
                placeholder="Search by vehicle number or model..."
                value={vehicleSearch}
                onChange={e => setVehicleSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: 13 }}
              />
            </div>
            <select
              value={vehicleFilter}
              onChange={e => setVehicleFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All Availability</option>
              <option value="available">Available</option>
              <option value="onTrip">On Trip</option>
            </select>
          </div>

          {filteredVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>
              <Car size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ margin: '0 0 12px 0', fontSize: 13 }}>
                {vehicleSearch || vehicleFilter !== 'all' ? 'No vehicles match the search criteria.' : 'No fleet vehicles added yet.'}
              </p>
              {!vehicleSearch && vehicleFilter === 'all' && drivers.length > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewVehicleModal(true)}>
                  + Add Your First Vehicle
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Body</th>
                    <th>Assigned Driver</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => (
                    <tr key={v._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {v.vehicleImage ? (
                            <img
                              src={v.vehicleImage}
                              alt={v.vehicleNumber}
                              style={{ width: 44, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 34, background: '#e5e7eb', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Car size={18} color="#9ca3af" />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600 }}>{v.vehicleNumber}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {v._id.slice(-6).toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td>{v.vehicleModel}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.vehicleType}</td>
                      <td>{v.loadCapacity?.value} {v.loadCapacity?.unit}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.bodyType || 'open'}</td>
                      <td>
                        {v.driver?.fullName ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{v.driver.fullName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status: {v.driver.approvalStatus}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${v.isAvailable ? 'success' : 'warning'}`}>
                          {v.isAvailable ? 'Available' : 'On Trip'}
                        </span>
                        {!v.isActive && (
                          <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>Inactive</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditVehicleModal({
                              open: true,
                              vehicleId: v._id,
                              vehicleModel: v.vehicleModel || '',
                              vehicleType: v.vehicleType || 'mini-truck',
                              loadCapacityValue: v.loadCapacity?.value || 1000,
                              loadCapacityUnit: v.loadCapacity?.unit || 'kg',
                              bodyType: v.bodyType || 'open',
                              vehicleImage: v.vehicleImage || '',
                              isActive: v.isActive !== false,
                              saving: false
                            })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setAssignModal({ open: true, vehicleId: v._id, driverId: v.driver?._id || '', assigning: false })}
                          >
                            Assign Driver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Fleet Trips & Dispatches ({bookings.length})</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Commercial customer shipments allocated to agency vehicles.</div>
            </div>
            <select
              value={bookingFilter}
              onChange={e => setBookingFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All Booking Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {filteredBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <MapPin size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>No customer bookings found</div>
              <p style={{ fontSize: 13, margin: 0, maxWidth: 440, marginInline: 'auto' }}>
                Customer bookings will appear here automatically when customer requests match your approved drivers and available fleet vehicles.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Customer</th>
                    <th>Pickup & Drop</th>
                    <th>Vehicle & Driver</th>
                    <th>Status</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.bookingId}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.customer?.name || 'Customer'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.customer?.phone || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>From:</strong> {b.pickup?.address || '—'}
                        </div>
                        <div style={{ fontSize: 12, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                          <strong>To:</strong> {b.drop?.address || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{b.vehicle?.vehicleNumber || b.vehicleType}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Driver: {b.driver?.fullName || 'Pending'}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          b.bookingStatus === 'completed' ? 'success' :
                          b.bookingStatus === 'in_transit' ? 'info' :
                          b.bookingStatus === 'cancelled' ? 'danger' : 'warning'
                        }`}>
                          {b.bookingStatus}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        ₹{b.finalFare || b.estimatedFare || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE & KYC */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Profile Details Edit */}
          <div className="card">
            <h3 style={{ fontSize: 16, margin: '0 0 4px 0' }}>Agency Business Profile</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Update registered trade name, physical address and operating city.</p>

            {profileForm.message && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {profileForm.message}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Agency Trade Name *</label>
                <input
                  type="text"
                  required
                  value={profileForm.agencyName}
                  onChange={e => setProfileForm({ ...profileForm, agencyName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Phone Number (Owner Account)</label>
                <input
                  type="text"
                  disabled
                  value={agency.phone || ''}
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  disabled
                  value={agency.email || ''}
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Office Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="e.g. Plot 45, Transport Nagar"
                />
              </div>

              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                  placeholder="e.g. Ludhiana"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={profileForm.saving} style={{ marginTop: 8 }}>
                {profileForm.saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* KYC Documents Status */}
          <div className="card">
            <h3 style={{ fontSize: 16, margin: '0 0 4px 0' }}>Verification Documents (KYC)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Documents are secured in an authorized vault accessible via short-lived signed links.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Owner Aadhaar */}
              <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Owner Aadhaar Document</div>
                  <span className={`badge ${agency.documents?.ownerAadhaar?.url ? 'success' : 'danger'}`}>
                    {agency.documents?.ownerAadhaar?.url ? 'Submitted' : 'Missing'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Masked Aadhaar proof used for statutory identity compliance.
                </p>
                {(agency.documents?.ownerAadhaar?.viewUrl || agency.documents?.ownerAadhaar?.url) ? (
                  <a
                    href={agency.documents.ownerAadhaar.viewUrl || agency.documents.ownerAadhaar.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={13} /> View Submitted Aadhaar
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: '#991b1b' }}>Not uploaded during registration</span>
                )}
              </div>

              {/* Business Registration */}
              <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Business Registration Document</div>
                  <span className={`badge ${agency.documents?.businessRegistration?.url ? 'success' : 'default'}`}>
                    {agency.documents?.businessRegistration?.url ? 'Submitted' : 'Optional'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Trade licence, GSTIN or commercial transport registration document.
                </p>
                {(agency.documents?.businessRegistration?.viewUrl || agency.documents?.businessRegistration?.url) ? (
                  <a
                    href={agency.documents.businessRegistration.viewUrl || agency.documents.businessRegistration.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={13} /> View Registration Certificate
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No business certificate attached</span>
                )}
              </div>

              {/* Verification Info */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Super Admin Authority</div>
                Only platform administrators can approve, reject or suspend agency accounts. Once approved, your fleet status is active for dispatches across LoadBalbin.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Modal: Register Driver */}
      {newDriverModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Register New Fleet Driver</h3>
              <button type="button" onClick={() => setNewDriverModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Driver will be registered under your agency. Super Admin approval is required before the driver can accept bookings.
            </p>
            <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Driver Full Name *</label>
                <input
                  type="text"
                  required
                  value={newDriver.fullName}
                  onChange={(e) => setNewDriver({ ...newDriver, fullName: e.target.value })}
                  placeholder="e.g. Gurpreet Singh"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                    placeholder="e.g. +919811122233"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newDriver.email}
                    onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                    placeholder="driver@example.com"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Initial Login Password *</label>
                <input
                  type="password"
                  required
                  value={newDriver.password}
                  onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="form-group">
                <label>Residential Address</label>
                <input
                  type="text"
                  value={newDriver.address}
                  onChange={(e) => setNewDriver({ ...newDriver, address: e.target.value })}
                  placeholder="e.g. Street 10, Model Town"
                />
              </div>

              {/* KYC Documents */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' }}>
                  Driver KYC Documents (Private Vault)
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Driver Aadhaar Card (PDF / Image)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'aadhaarUrl', setNewDriver, 'aadhaar')}
                    />
                    {uploadingDoc === 'aadhaarUrl' && <span style={{ fontSize: 11, color: 'var(--primary)' }}>Uploading to vault…</span>}
                  </div>
                  <input
                    type="url"
                    value={newDriver.aadhaarUrl}
                    onChange={(e) => setNewDriver({ ...newDriver, aadhaarUrl: e.target.value })}
                    placeholder="Or enter secure URL: https://.../driver-aadhaar.pdf"
                    style={{ fontSize: 12 }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Driver Driving Licence (PDF / Image)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(e, 'dlUrl', setNewDriver, 'drivingLicense')}
                    />
                    {uploadingDoc === 'dlUrl' && <span style={{ fontSize: 11, color: 'var(--primary)' }}>Uploading to vault…</span>}
                  </div>
                  <input
                    type="url"
                    value={newDriver.dlUrl}
                    onChange={(e) => setNewDriver({ ...newDriver, dlUrl: e.target.value })}
                    placeholder="Or enter secure URL: https://.../driver-dl.pdf"
                    style={{ fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setNewDriverModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingDriver}>
                  {creatingDriver ? 'Registering...' : 'Create Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Driver KYC */}
      {docModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Upload Driver KYC Documents</h3>
              <button type="button" onClick={() => setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '', updating: false })} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Upload Aadhaar and Driving Licence to update this driver's KYC dossier for Super Admin verification.
            </p>
            <form onSubmit={handleUpdateDriverDocs} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Driver Aadhaar Card (PDF or Image)</label>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  🛡️ <strong>UIDAI Notice:</strong> Please submit a <strong>Masked Aadhaar</strong> (first 8 digits hidden).
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'aadhaarUrl', setDocModal, 'aadhaar')}
                  />
                  {uploadingDoc === 'aadhaarUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading to private vault…</span>}
                </div>
                <input
                  type="url"
                  value={docModal.aadhaarUrl}
                  onChange={(e) => setDocModal({ ...docModal, aadhaarUrl: e.target.value })}
                  placeholder="Or enter URL: https://.../driver-aadhaar.pdf"
                />
              </div>
              <div className="form-group">
                <label>Driver Driving Licence (PDF or Image)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'dlUrl', setDocModal, 'drivingLicense')}
                  />
                  {uploadingDoc === 'dlUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
                </div>
                <input
                  type="url"
                  value={docModal.dlUrl}
                  onChange={(e) => setDocModal({ ...docModal, dlUrl: e.target.value })}
                  placeholder="Or enter URL: https://.../driver-dl.pdf"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '', updating: false })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={docModal.updating}>
                  {docModal.updating ? 'Saving...' : 'Save Documents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {newVehicleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Add Commercial Fleet Vehicle</h3>
              <button type="button" onClick={() => setNewVehicleModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <form onSubmit={handleCreateVehicle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Assign Driver *</label>
                <select
                  required
                  value={newVehicle.driverId}
                  onChange={(e) => setNewVehicle({ ...newVehicle, driverId: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                >
                  <option value="">Select an agency driver...</option>
                  {drivers.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.fullName || d.user?.name} ({d.approvalStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Vehicle Plate Number *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.vehicleNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value })}
                    placeholder="e.g. PB10AB1234"
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Model *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.vehicleModel}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleModel: e.target.value })}
                    placeholder="e.g. Tata 407 / Bolero"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Vehicle Type *</label>
                  <select
                    value={newVehicle.vehicleType}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleType: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="mini-truck">Mini Truck</option>
                    <option value="pickup">Pickup</option>
                    <option value="small-truck">Small Truck</option>
                    <option value="medium-truck">Medium Truck</option>
                    <option value="large-truck">Large Truck</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Body Type</label>
                  <select
                    value={newVehicle.bodyType}
                    onChange={(e) => setNewVehicle({ ...newVehicle, bodyType: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="container">Container</option>
                    <option value="flatbed">Flatbed</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Load Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newVehicle.loadCapacityValue}
                    onChange={(e) => setNewVehicle({ ...newVehicle, loadCapacityValue: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={newVehicle.loadCapacityUnit}
                    onChange={(e) => setNewVehicle({ ...newVehicle, loadCapacityUnit: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Vehicle Photo</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'vehicleImage', setNewVehicle, 'vehicle')}
                  />
                  {uploadingDoc === 'vehicleImage' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
                </div>
                <input
                  type="url"
                  value={newVehicle.vehicleImage}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicleImage: e.target.value })}
                  placeholder="Or enter URL: https://.../vehicle.jpg"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setNewVehicleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingVehicle}>
                  {creatingVehicle ? 'Adding...' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Vehicle */}
      {editVehicleModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Edit Fleet Vehicle</h3>
              <button type="button" onClick={() => setEditVehicleModal({ open: false, vehicleId: null, vehicleModel: '', vehicleType: 'mini-truck', loadCapacityValue: 1000, loadCapacityUnit: 'kg', bodyType: 'open', vehicleImage: '', isActive: true, saving: false })} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <form onSubmit={handleUpdateVehicle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Vehicle Model *</label>
                <input
                  type="text"
                  required
                  value={editVehicleModal.vehicleModel}
                  onChange={(e) => setEditVehicleModal({ ...editVehicleModal, vehicleModel: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Vehicle Type *</label>
                  <select
                    value={editVehicleModal.vehicleType}
                    onChange={(e) => setEditVehicleModal({ ...editVehicleModal, vehicleType: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="mini-truck">Mini Truck</option>
                    <option value="pickup">Pickup</option>
                    <option value="small-truck">Small Truck</option>
                    <option value="medium-truck">Medium Truck</option>
                    <option value="large-truck">Large Truck</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Body Type</label>
                  <select
                    value={editVehicleModal.bodyType}
                    onChange={(e) => setEditVehicleModal({ ...editVehicleModal, bodyType: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="container">Container</option>
                    <option value="flatbed">Flatbed</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Load Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editVehicleModal.loadCapacityValue}
                    onChange={(e) => setEditVehicleModal({ ...editVehicleModal, loadCapacityValue: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    value={editVehicleModal.loadCapacityUnit}
                    onChange={(e) => setEditVehicleModal({ ...editVehicleModal, loadCapacityUnit: e.target.value })}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Vehicle Photo</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'vehicleImage', setEditVehicleModal, 'vehicle')}
                  />
                  {uploadingDoc === 'vehicleImage' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
                </div>
                <input
                  type="url"
                  value={editVehicleModal.vehicleImage}
                  onChange={(e) => setEditVehicleModal({ ...editVehicleModal, vehicleImage: e.target.value })}
                  placeholder="Or enter URL: https://.../vehicle.jpg"
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editVehicleModal.isActive}
                    onChange={(e) => setEditVehicleModal({ ...editVehicleModal, isActive: e.target.checked })}
                  />
                  <span>Vehicle is Active for Dispatches</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditVehicleModal({ open: false, vehicleId: null, vehicleModel: '', vehicleType: 'mini-truck', loadCapacityValue: 1000, loadCapacityUnit: 'kg', bodyType: 'open', vehicleImage: '', isActive: true, saving: false })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editVehicleModal.saving}>
                  {editVehicleModal.saving ? 'Saving...' : 'Update Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Driver */}
      {assignModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Assign Driver to Vehicle</h3>
              <button type="button" onClick={() => setAssignModal({ open: false, vehicleId: null, driverId: '', assigning: false })} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <form onSubmit={handleAssignVehicle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Select Agency Driver *</label>
                <select
                  required
                  value={assignModal.driverId}
                  onChange={(e) => setAssignModal({ ...assignModal, driverId: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                >
                  <option value="">Choose driver...</option>
                  {drivers.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.fullName || d.user?.name} ({d.approvalStatus})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAssignModal({ open: false, vehicleId: null, driverId: '', assigning: false })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={assignModal.assigning}>
                  {assignModal.assigning ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
