import React, { useEffect, useState } from 'react';
import agencyService from '../../services/agencyService';
import {
  Building2, Users, Car, MapPin, RefreshCw, PlusCircle,
  UploadCloud, AlertCircle, CheckCircle2, XCircle, Clock,
  Search, ShieldCheck, Phone, Mail, FileText, ArrowRight,
  ChevronRight, Calendar, Info, Check, Eye, UserPlus, X
} from 'lucide-react';

const isVehicleDispatchReady = (vehicle, agency) => Boolean(
  agency.approvalStatus === 'approved' &&
  agency.isActive !== false &&
  vehicle.isActive !== false &&
  vehicle.isAvailable &&
  vehicle.driver?.isActive !== false &&
  vehicle.driver?.approvalStatus === 'approved' &&
  vehicle.driver?.documents?.idProof?.status === 'approved' &&
  vehicle.driver?.documents?.drivingLicense?.status === 'approved' &&
  vehicle.documents?.registration?.status === 'approved' &&
  vehicle.documents?.insurance?.status === 'approved'
);

export default function AgencyDashboard() {
  const [agency, setAgency] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, requests, drivers, vehicles, bookings, profile

  // Joining requests & stats state
  const [joiningRequests, setJoiningRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
  const [rejectModal, setRejectModal] = useState({
    open: false,
    requestId: null,
    driverName: '',
    reason: '',
    processing: false
  });
  const [approveModal, setApproveModal] = useState({
    open: false,
    driverId: null,
    driverName: '',
    agencyName: '',
    processing: false
  });
  const [stats, setStats] = useState({
    total: 0,
    pendingAgency: 0,
    acceptedPendingSuperAdmin: 0,
    superAdminApprovedAndEligible: 0,
    rejectedOrSuspended: 0
  });

  // Search & filter states
  const handleAcceptRequest = async (requestId) => {
    try {
      setAcceptingRequestId(requestId);
      await agencyService.acceptAgencyDriverRequest(requestId);
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to accept driver request');
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const handleConfirmApproveJoining = async () => {
    if (!approveModal.driverId) return;
    try {
      setApproveModal(prev => ({ ...prev, processing: true }));
      await agencyService.acceptAgencyDriverRequest(approveModal.driverId);
      setApproveModal({ open: false, driverId: null, driverName: '', agencyName: '', processing: false });
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to approve driver joining request');
      setApproveModal(prev => ({ ...prev, processing: false }));
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectModal.reason.trim()) {
      alert('Please provide a reason for rejecting this driver request.');
      return;
    }
    try {
      setRejectModal(prev => ({ ...prev, processing: true }));
      await agencyService.rejectAgencyDriverRequest(rejectModal.requestId, rejectModal.reason.trim());
      setRejectModal({ open: false, requestId: null, driverName: '', reason: '', processing: false });
      await loadData(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reject driver request');
      setRejectModal(prev => ({ ...prev, processing: false }));
    }
  };

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
  const [docModal, setDocModal] = useState({
    open: false,
    driverId: null,
    driverName: '',
    aadhaarUrl: '',
    aadhaarFile: null,
    aadhaarFileName: '',
    aadhaarUrl_publicId: '',
    aadhaarUrl_resourceType: 'image',
    aadhaarUrl_format: 'pdf',
    dlUrl: '',
    dlFile: null,
    dlFileName: '',
    dlUrl_publicId: '',
    dlUrl_resourceType: 'image',
    dlUrl_format: 'pdf',
    updating: false,
    error: '',
    success: ''
  });

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
  const [assignModal, setAssignModal] = useState({
    open: false,
    vehicle: null,
    vehicleId: null,
    driverId: '',
    assigning: false,
    error: ''
  });
  const [uploadingDoc, setUploadingDoc] = useState('');

  // Profile update form state
  const [profileForm, setProfileForm] = useState({
    agencyName: '',
    address: '',
    city: '',
    saving: false,
    message: ''
  });
  const [agencyDocumentError, setAgencyDocumentError] = useState('');

  const handleFileUpload = async (e, targetField, setter, purpose = 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller file.');
      e.target.value = '';
      return;
    }

    if (purpose === 'aadhaar' || purpose === 'drivingLicense') {
      if (setter === setDocModal && docModal.driverId) {
        try {
          setUploadingDoc(targetField);
          const docType = purpose === 'aadhaar' ? 'idProof' : 'drivingLicense';
          await agencyService.uploadDriverDocument(docModal.driverId, docType, file);
          setter(prev => ({
            ...prev,
            [targetField]: 'uploaded',
            [`${targetField}_fileName`]: file.name,
            error: ''
          }));
        } catch (uploadErr) {
          setter(prev => ({
            ...prev,
            error: uploadErr.response?.data?.message || uploadErr.message || 'Secure document upload failed'
          }));
        } finally {
          setUploadingDoc('');
        }
      } else {
        setter(prev => ({
          ...prev,
          [targetField]: file.name,
          [`${targetField}_file`]: file,
          [`${targetField}_fileName`]: file.name
        }));
      }
      return;
    }

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
        [`${targetField}_file`]: file,
        [`${targetField}_fileName`]: file.name,
        [`${targetField}_publicId`]: publicId,
        [`${targetField}_resourceType`]: resourceType,
        [`${targetField}_format`]: format,
        error: ''
      }));
    } catch (uploadErr) {
      alert(uploadErr.response?.data?.message || uploadErr.message || 'File upload failed');
    } finally {
      setUploadingDoc('');
    }
  };

  const handleVehicleDocumentUpload = async (event, vehicleId, docType) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller file.');
      event.target.value = '';
      return;
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      alert('Choose a JPEG, PNG, WebP, or PDF document.');
      event.target.value = '';
      return;
    }
    const key = `vehicle-${vehicleId}-${docType}`;
    try {
      setUploadingDoc(key);
      await agencyService.uploadVehicleDocument(vehicleId, docType, file);
      await loadData();
    } catch (uploadErr) {
      alert(uploadErr.response?.data?.message || uploadErr.message || 'Secure vehicle document upload failed');
    } finally {
      setUploadingDoc('');
      event.target.value = '';
    }
  };

  // Registration form (if no agency yet)
  const [regForm, setRegForm] = useState({
    agencyName: '',
    phone: '',
    email: '',
    address: '',
    city: ''
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

      const [drRes, vRes, bRes, reqRes, statsRes] = await Promise.all([
        agencyService.getAgencyDrivers(),
        agencyService.getAgencyVehicles(),
        agencyService.getAgencyBookings(),
        agencyService.getAgencyDriverRequests().catch(() => ({ data: { data: { requests: [] } } })),
        agencyService.getAgencyStats().catch(() => ({ data: { data: { counts: null } } }))
      ]);

      const loadedDrivers = drRes.data.data.drivers || [];
      const loadedRequests = reqRes.data?.data?.requests || [];
      setDrivers(loadedDrivers);
      setJoiningRequests(loadedRequests);
      const loadedVehicles = vRes.data.data.vehicles || [];
      const loadedBookings = bRes.data.data.bookings || [];
      setVehicles(loadedVehicles);
      setBookings(loadedBookings);
      setAssignModal(prev => {
        if (prev.open && prev.vehicleId) {
          const fresh = loadedVehicles.find(v => v._id === prev.vehicleId);
          return fresh ? { ...prev, vehicle: fresh } : prev;
        }
        return prev;
      });
      setBookingCount(bRes.data.data.pagination?.total ?? loadedBookings.length);
      if (statsRes.data?.data?.counts) {
        setStats(statsRes.data.data.counts);
      } else {
        const resolvedList = loadedDrivers.map(d => ({
          ...d,
          associationStatus: d.agencyAssociation?.status || (d.agency ? (d.approvalStatus === 'approved' ? 'approved' : 'pending') : 'none')
        }));
        setStats({
          total: loadedDrivers.length,
          pendingAgency: resolvedList.filter(d => d.associationStatus === 'pending').length,
          acceptedPendingSuperAdmin: resolvedList.filter(d => d.associationStatus === 'approved' && d.approvalStatus === 'pending').length,
          superAdminApprovedAndEligible: resolvedList.filter(d => d.associationStatus === 'approved' && d.approvalStatus === 'approved' && d.isActive !== false).length,
          rejectedOrSuspended: resolvedList.filter(d => d.associationStatus === 'rejected' || d.approvalStatus === 'rejected' || d.approvalStatus === 'suspended').length
        });
      }
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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('agency-tab-change', { detail: { tab: activeTab } }));
    const pendingReqCount = joiningRequests.filter(r => r.agencyAssociation?.status === 'pending').length;
    window.dispatchEvent(new CustomEvent('agency-dashboard-counts', {
      detail: loading
        ? { requests: null, drivers: null, vehicles: null, trips: null }
        : { requests: pendingReqCount, drivers: drivers.length, vehicles: vehicles.length, trips: bookingCount }
    }));
  }, [activeTab, bookingCount, drivers.length, joiningRequests, loading, vehicles.length]);

  useEffect(() => {
    const handleCustomQuickAction = (e) => {
      const action = e.detail?.action;
      if (action === 'register-driver') {
        setNewDriverModal(true);
      } else if (action === 'add-vehicle') {
        if (drivers.length === 0) {
          alert('Please register at least one driver before adding a vehicle.');
          setNewDriverModal(true);
        } else {
          setNewVehicleModal(true);
        }
      }
    };

    const handleAgencyTabSelect = (e) => {
      const tab = e.detail?.tab;
      if (['overview', 'requests', 'drivers', 'vehicles', 'bookings', 'profile'].includes(tab)) {
        setActiveTab(tab);
      }
    };

    window.addEventListener('agency-quick-action', handleCustomQuickAction);
    window.addEventListener('agency-tab-select', handleAgencyTabSelect);
    return () => {
      window.removeEventListener('agency-quick-action', handleCustomQuickAction);
      window.removeEventListener('agency-tab-select', handleAgencyTabSelect);
    };
  }, [drivers.length]);

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
        city: regForm.city
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

  const handleAgencyDocumentUpload = async (event, docType) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (file.size > 5 * 1024 * 1024) {
      setAgencyDocumentError('File size exceeds the 5MB limit.');
      event.target.value = '';
      return;
    }
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      setAgencyDocumentError('Choose a JPEG, PNG, WebP, or PDF document.');
      event.target.value = '';
      return;
    }

    const key = `agency-${docType}`;
    setAgencyDocumentError('');
    try {
      setUploadingDoc(key);
      await agencyService.uploadAgencyDocument(agency._id, docType, file);
      await loadData();
    } catch (uploadError) {
      setAgencyDocumentError(
        uploadError.response?.data?.message || uploadError.message || 'Secure document upload failed'
      );
    } finally {
      setUploadingDoc('');
      event.target.value = '';
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
        address: newDriver.address || ''
      };

      const response = await agencyService.createAgencyDriver(payload);
      const createdDriverId = response.data?.data?.driver?._id;
      if (!createdDriverId) throw new Error('Driver was created, but the API did not return its identifier.');
      if (newDriver.aadhaarUrl_file) {
        await agencyService.uploadDriverDocument(createdDriverId, 'idProof', newDriver.aadhaarUrl_file);
      }
      if (newDriver.dlUrl_file) {
        await agencyService.uploadDriverDocument(createdDriverId, 'drivingLicense', newDriver.dlUrl_file);
      }
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
      alert(err.response?.data?.message || err.message || 'Driver registration or secure document upload failed');
    } finally {
      setCreatingDriver(false);
    }
  };

  const handleUpdateDriverDocs = async (e) => {
    e.preventDefault();
    if (!docModal.aadhaarUrl || !docModal.dlUrl) {
      setDocModal(prev => ({
        ...prev,
        error: 'Both Driver Aadhaar Card and Driving Licence are required to update verification documents.'
      }));
      return;
    }

    try {
      setDocModal(prev => ({ ...prev, updating: true, error: '', success: '' }));
      setDocModal(prev => ({ ...prev, updating: false, success: 'Driver documents successfully saved and queued for Super Admin review!' }));
      await loadData();
      setTimeout(() => {
        setDocModal({
          open: false,
          driverId: null,
          driverName: '',
          aadhaarUrl: '',
          aadhaarFile: null,
          aadhaarFileName: '',
          aadhaarUrl_publicId: '',
          aadhaarUrl_resourceType: 'image',
          aadhaarUrl_format: 'pdf',
          dlUrl: '',
          dlFile: null,
          dlFileName: '',
          dlUrl_publicId: '',
          dlUrl_resourceType: 'image',
          dlUrl_format: 'pdf',
          updating: false,
          error: '',
          success: ''
        });
      }, 1500);
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.message || 'Failed to update driver documents';
      setDocModal(prev => ({ ...prev, updating: false, error: serverMsg }));
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
    e?.preventDefault();
    if (!assignModal.vehicleId || !assignModal.driverId) return;
    try {
      setAssignModal(prev => ({ ...prev, assigning: true, error: '' }));
      await agencyService.assignVehicleDriver(assignModal.vehicleId, assignModal.driverId);
      await loadData(true);
      setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' });
    } catch (err) {
      setAssignModal(prev => ({
        ...prev,
        assigning: false,
        error: err.response?.data?.message || err.message || 'Failed to assign driver'
      }));
    }
  };

  const handleUnassignVehicle = async () => {
    if (!assignModal.vehicleId) return;
    try {
      setAssignModal(prev => ({ ...prev, assigning: true, error: '' }));
      await agencyService.assignVehicleDriver(assignModal.vehicleId, null);
      await loadData(true);
      setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' });
    } catch (err) {
      setAssignModal(prev => ({
        ...prev,
        assigning: false,
        error: err.response?.data?.message || err.message || 'Failed to unassign driver'
      }));
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
          Register your transport fleet to manage commercial vehicles and drivers. The agency profile starts pending; submit optional business documents and Owner Aadhaar securely from Profile & KYC after registration.
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

          <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            After registration, upload Owner Aadhaar securely from Profile & KYC. Business registration and tax documents are optional and can also be submitted there.
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
    if (!matchesSearch) return false;
    if (driverFilter === 'all') return true;
    const assocStatus = d.agencyAssociation?.status || (d.agency ? (d.approvalStatus === 'approved' ? 'approved' : 'pending') : 'none');
    if (driverFilter === 'pending_agency') return assocStatus === 'pending';
    if (driverFilter === 'pending_admin') return assocStatus === 'approved' && d.approvalStatus === 'pending';
    if (driverFilter === 'pending') return assocStatus === 'pending' || d.approvalStatus === 'pending';
    if (driverFilter === 'approved') return d.approvalStatus === 'approved';
    if (driverFilter === 'rejected') return assocStatus === 'rejected' || d.approvalStatus === 'rejected';
    if (driverFilter === 'suspended') return d.approvalStatus === 'suspended';
    return d.approvalStatus === driverFilter;
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

  const approvedDriversCount = drivers.filter(d =>
    d.isActive !== false &&
    d.approvalStatus === 'approved' &&
    d.documents?.idProof?.status === 'approved' &&
    d.documents?.drivingLicense?.status === 'approved'
  ).length;
  const pendingDriversCount = drivers.filter(d => d.approvalStatus === 'pending').length;
  const availableFleetCount = vehicles.filter(v => v.isActive !== false && v.isAvailable).length;
  const dispatchReadyFleetCount = vehicles.filter(v => isVehicleDispatchReady(v, agency)).length;

  return (
    <div className="agency-dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

        {error && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 8 }}>
            <div>{error}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => loadData(true)} disabled={refreshing} style={{ marginTop: 8 }}>
              Retry loading dashboard
            </button>
          </div>
        )}

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

      {/* 3. Metric Summary Cards - Agency Driver Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Registered</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(22, 119, 255, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={17} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total ?? drivers.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Total drivers associated</div>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('requests')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Agency Approval</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={17} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b' }}>{stats.pendingAgency}</div>
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>Action required &rarr;</div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Accepted, Pending Admin</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={17} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#6366f1' }}>{stats.acceptedPendingSuperAdmin}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Awaiting Super Admin</div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Approved &amp; Eligible</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={17} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#10b981' }}>{stats.superAdminApprovedAndEligible}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Active &amp; verified KYC</div>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Rejected / Suspended</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={17} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{stats.rejectedOrSuspended}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Excluded from dispatch</div>
          </div>
        </div>
      </div>

      {/* Selected dashboard section */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
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
                        d.approvalStatus === 'approved' && d.isActive !== false ? 'success' :
                        d.approvalStatus === 'rejected' || d.approvalStatus === 'suspended' || d.isActive === false ? 'danger' : 'warning'
                      }`}>
                        {d.isActive === false ? 'Inactive' : d.approvalStatus === 'pending' ? 'Pending Super Admin Verification' : d.approvalStatus}
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
                      <span className={`badge ${isVehicleDispatchReady(v, agency) ? 'success' : 'warning'}`}>
                        {isVehicleDispatchReady(v, agency) ? 'Dispatch ready' : v.isAvailable ? 'Available · not dispatch-ready' : 'On Trip'}
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

            {/* TAB: DRIVER JOINING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="var(--primary)" />
                Driver Joining Requests
                {joiningRequests.filter(r => r.agencyAssociation?.status === 'pending').length > 0 && (
                  <span className="badge warning" style={{ fontSize: 11 }}>
                    {joiningRequests.filter(r => r.agencyAssociation?.status === 'pending').length} Action Required
                  </span>
                )}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Only you as this agency admin can accept or reject driver joining requests. Acceptance associates the driver with your agency for Super Admin KYC verification.
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => loadData(true)}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh Requests
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search requests by driver name, phone, or email..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                style={{ paddingLeft: 32, width: '100%', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'pending', 'approved', 'rejected'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn btn-sm ${requestFilter === f ? 'btn-primary' : 'btn-outline'}`}
                  style={{ textTransform: 'capitalize' }}
                  onClick={() => setRequestFilter(f)}
                >
                  {f === 'all' ? 'All Requests' : f === 'pending' ? 'Pending Agency' : f === 'approved' ? 'Accepted' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          {(() => {
            const filtered = joiningRequests.filter((r) => {
              const statusMatch = requestFilter === 'all' || (r.agencyAssociation?.status || 'pending') === requestFilter;
              const searchMatch = !requestSearch.trim() ||
                (r.fullName || '').toLowerCase().includes(requestSearch.toLowerCase()) ||
                (r.phone || '').includes(requestSearch) ||
                (r.email || '').toLowerCase().includes(requestSearch.toLowerCase());
              return statusMatch && searchMatch;
            });

            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                  <UserPlus size={36} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No driver joining requests found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {requestFilter !== 'all' ? `No ${requestFilter} requests match your filter.` : 'Drivers registering with your agency will appear here for review.'}
                  </div>
                </div>
              );
            }

            return (
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 12px' }}>Driver Name</th>
                      <th style={{ padding: '10px 12px' }}>Contact</th>
                      <th style={{ padding: '10px 12px' }}>Registered Date</th>
                      <th style={{ padding: '10px 12px' }}>Aadhaar (ID)</th>
                      <th style={{ padding: '10px 12px' }}>Driving Licence</th>
                      <th style={{ padding: '10px 12px' }}>Agency Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((req) => {
                      const assocStatus = req.agencyAssociation?.status || 'pending';
                      const aadhaarStatus = req.documents?.idProof?.status || 'not_uploaded';
                      const dlStatus = req.documents?.drivingLicense?.status || 'not_uploaded';
                      const isPending = assocStatus === 'pending';

                      return (
                        <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{req.fullName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {req.id}</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div>{req.phone || '—'}</div>
                            {req.email ? <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.email}</div> : null}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span className={`badge ${aadhaarStatus === 'approved' ? 'success' : aadhaarStatus === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: 11 }}>
                              {aadhaarStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span className={`badge ${dlStatus === 'approved' ? 'success' : dlStatus === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: 11 }}>
                              {dlStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span className={`badge ${assocStatus === 'approved' ? 'success' : assocStatus === 'rejected' ? 'danger' : 'warning'}`}>
                              {assocStatus === 'approved' ? 'Accepted' : assocStatus === 'rejected' ? 'Rejected' : 'Pending Agency'}
                            </span>
                            {assocStatus === 'rejected' && req.agencyAssociation?.rejectionReason && (
                              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>
                                Reason: {req.agencyAssociation.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {isPending ? (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  style={{ padding: '4px 10px', fontSize: 12, background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                                  onClick={() => setApproveModal({
                                    open: true,
                                    driverId: req.id,
                                    driverName: req.fullName,
                                    agencyName: agency?.agencyName || 'Your Agency',
                                    processing: false
                                  })}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  style={{ padding: '4px 10px', fontSize: 12, borderColor: '#ef4444', color: '#ef4444' }}
                                  onClick={() => setRejectModal({ open: true, requestId: req.id, driverName: req.fullName, reason: '', processing: false })}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : assocStatus === 'approved' ? (
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                Accepted &bull; Pending Super Admin
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#dc2626' }}>
                                Rejected
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
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
              style={{ width: 'auto', minWidth: 160, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All Verification Statuses</option>
              <option value="pending_agency">Pending Agency Approval</option>
              <option value="pending_admin">Accepted, Pending Super Admin</option>
              <option value="approved">Super Admin Approved</option>
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
                    <th>Registered</th>
                    <th>Assigned Vehicle</th>
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
                      <td>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</td>
                      <td>
                        {d.assignedVehicle ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{d.assignedVehicle.vehicleNumber || 'Assigned'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {[d.assignedVehicle.vehicleModel, d.assignedVehicle.vehicleType].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </>
                        ) : 'Not assigned'}
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
                            {d.documents?.idProof?.viewUrl ? (
                              <a
                                href={d.documents.idProof.viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#166534', fontWeight: 600 }}
                              >
                                View
                              </a>
                            ) : (
                              <span style={{ color: '#991b1b' }}>Missing</span>
                            )}
                            <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                              {' '}· {d.documents?.idProof?.status?.replace('_', ' ') || 'not uploaded'}
                            </span>
                            {d.documents?.idProof?.submittedAt ? <div style={{ color: 'var(--text-secondary)' }}>Submitted {new Date(d.documents.idProof.submittedAt).toLocaleDateString()}</div> : null}
                            {d.documents?.idProof?.rejectionReason ? <div style={{ color: '#991b1b' }}>{d.documents.idProof.rejectionReason}</div> : null}
                          </div>
                          <div>
                            Licence:{' '}
                            {d.documents?.drivingLicense?.viewUrl ? (
                              <a
                                href={d.documents.drivingLicense.viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#166534', fontWeight: 600 }}
                              >
                                View
                              </a>
                            ) : (
                              <span style={{ color: '#991b1b' }}>Missing</span>
                            )}
                            <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                              {' '}· {d.documents?.drivingLicense?.status?.replace('_', ' ') || 'not uploaded'}
                            </span>
                            {d.documents?.drivingLicense?.submittedAt ? <div style={{ color: 'var(--text-secondary)' }}>Submitted {new Date(d.documents.drivingLicense.submittedAt).toLocaleDateString()}</div> : null}
                            {d.documents?.drivingLicense?.rejectionReason ? <div style={{ color: '#991b1b' }}>{d.documents.drivingLicense.rejectionReason}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                          {(() => {
                            const assocStatus = d.agencyAssociation?.status || (d.agency ? (d.approvalStatus === 'approved' ? 'approved' : 'pending') : 'none');
                            if (assocStatus === 'pending') {
                              return (
                                <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    style={{ padding: '4px 10px', fontSize: 12, background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                                    onClick={() => setApproveModal({
                                      open: true,
                                      driverId: d._id,
                                      driverName: d.fullName || d.user?.name || 'Driver',
                                      agencyName: agency?.agencyName || 'Your Agency',
                                      processing: false
                                    })}
                                  >
                                    Approve Joining
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline"
                                    style={{ padding: '4px 10px', fontSize: 12, borderColor: '#ef4444', color: '#ef4444' }}
                                    onClick={() => setRejectModal({
                                      open: true,
                                      requestId: d._id,
                                      driverName: d.fullName || d.user?.name || 'Driver',
                                      reason: '',
                                      processing: false
                                    })}
                                  >
                                    Reject
                                  </button>
                                </div>
                              );
                            }
                            if (assocStatus === 'approved') {
                              return (
                                <div>
                                  <span
                                    className="badge success"
                                    style={{
                                      display: 'inline-block',
                                      fontSize: 11,
                                      padding: '4px 8px',
                                      whiteSpace: 'normal',
                                      lineHeight: 1.3
                                    }}
                                  >
                                    {d.approvalStatus === 'approved'
                                      ? 'Agency Approved'
                                      : 'Agency Approved — Pending Super Admin Verification'}
                                  </span>
                                </div>
                              );
                            }
                            if (assocStatus === 'rejected') {
                              return (
                                <div>
                                  <span className="badge danger" style={{ fontSize: 11 }}>
                                    Rejected
                                  </span>
                                  {d.agencyAssociation?.rejectionReason && (
                                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                                      Reason: {d.agencyAssociation.rejectionReason}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => setDocModal({
                              open: true,
                              driverId: d._id,
                              driverName: d.fullName || d.user?.name || 'Driver',
                              aadhaarUrl: d.documents?.idProof?.url || '',
                              aadhaarFile: null,
                              aadhaarFileName: d.documents?.idProof?.url ? 'Current Aadhaar Document' : '',
                              aadhaarUrl_publicId: d.documents?.idProof?.publicId || '',
                              aadhaarUrl_resourceType: d.documents?.idProof?.resourceType || 'image',
                              aadhaarUrl_format: d.documents?.idProof?.format || 'pdf',
                              dlUrl: d.documents?.drivingLicense?.url || '',
                              dlFile: null,
                              dlFileName: d.documents?.drivingLicense?.url ? 'Current Driving Licence' : '',
                              dlUrl_publicId: d.documents?.drivingLicense?.publicId || '',
                              dlUrl_resourceType: d.documents?.drivingLicense?.resourceType || 'image',
                              dlUrl_format: d.documents?.drivingLicense?.format || 'pdf',
                              updating: false,
                              error: '',
                              success: ''
                            })}
                          >
                            Upload / Update Docs
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
                    <th>RC &amp; Insurance</th>
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
                        {!isVehicleDispatchReady(v, agency) && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Not eligible for dispatch</div>
                        )}
                        {!v.isActive && (
                          <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>Inactive</div>
                        )}
                      </td>
                      <td>
                        {[
                          { key: 'registration', label: 'RC' },
                          { key: 'insurance', label: 'Insurance' }
                        ].map((document) => (
                          <div key={document.key} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 11, marginBottom: 3 }}>
                              {document.label}: {v.documents?.[document.key]?.status || 'not uploaded'}
                              {v.documents?.[document.key]?.rejectionReason ? ` — ${v.documents[document.key].rejectionReason}` : ''}
                            </div>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              aria-label={`Upload or replace ${document.label} for ${v.vehicleNumber}`}
                              disabled={uploadingDoc === `vehicle-${v._id}-${document.key}`}
                              onChange={(event) => handleVehicleDocumentUpload(event, v._id, document.key)}
                              style={{ maxWidth: 190, fontSize: 11 }}
                            />
                            {uploadingDoc === `vehicle-${v._id}-${document.key}` ? (
                              <div style={{ fontSize: 10, color: 'var(--primary)' }}>Uploading privately…</div>
                            ) : null}
                          </div>
                        ))}
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
                            onClick={() => setAssignModal({
                              open: true,
                              vehicle: v,
                              vehicleId: v._id,
                              driverId: v.driver?._id || '',
                              assigning: false,
                              error: ''
                            })}
                          >
                            {v.driver ? 'Change Driver' : 'Assign Driver'}
                          </button>
                        </div>
                        {(v.documents?.registration?.status !== 'approved' || v.documents?.insurance?.status !== 'approved') ? (
                          <div style={{ marginTop: 5, fontSize: 10, color: '#b45309' }}>
                            RC or Insurance pending verification.
                          </div>
                        ) : null}
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
              <h3 style={{ margin: 0, fontSize: 16 }}>Fleet Trips & Dispatches ({bookingCount})</h3>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing the latest {bookings.length} of {bookingCount} agency-scoped bookings.</div>
            </div>
            <select
              value={bookingFilter}
              onChange={e => setBookingFilter(e.target.value)}
              style={{ width: 'auto', minWidth: 150, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All Booking Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="in-progress">In Progress</option>
              <option value="rejected">Rejected</option>
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
                {(() => {
                  const document = agency.documents?.ownerAadhaar || {};
                  const status = document.status || 'not_uploaded';
                  const mayUpload = status !== 'pending' || !document.viewUrl;
                  return (
                    <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Owner Aadhaar Document</div>
                  <span className={`badge ${status === 'approved' ? 'success' : status === 'rejected' || status === 'not_uploaded' ? 'danger' : 'warning'}`}>
                    {status === 'approved' ? 'Verified' : status === 'pending' ? 'Pending Super Admin Verification' : status === 'rejected' ? 'Rejected' : 'Missing'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Submit a masked Aadhaar securely for Super Admin review. Agency approval and driver-dropdown eligibility currently use the agency's active and approved status; owner Aadhaar is not a configured prerequisite.
                </p>
                {document.viewUrl ? (
                  <a
                    href={document.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={13} /> View Submitted Aadhaar
                  </a>
                ) : null}
                {document.submittedAt ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Submitted {new Date(document.submittedAt).toLocaleString()}</div> : null}
                {document.reviewedAt ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Reviewed {new Date(document.reviewedAt).toLocaleString()}</div> : null}
                {document.reviewedBy ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Reviewed by {document.reviewedBy}</div> : null}
                {document.rejectionReason ? <div role="alert" style={{ fontSize: 12, color: '#991b1b', marginTop: 6 }}>Reason: {document.rejectionReason}</div> : null}
                {mayUpload ? (
                  <label style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600 }}>
                    {status === 'rejected' ? 'Resubmit Owner Aadhaar' : status === 'approved' ? 'Replace with a private vault submission' : status === 'pending' ? 'Resubmit to the private vault for review' : 'Upload Owner Aadhaar'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      aria-label="Upload or resubmit owner Aadhaar"
                      disabled={uploadingDoc === 'agency-ownerAadhaar'}
                      onChange={(event) => handleAgencyDocumentUpload(event, 'ownerAadhaar')}
                      style={{ display: 'block', marginTop: 6 }}
                    />
                    {uploadingDoc === 'agency-ownerAadhaar' ? <span role="status">Uploading securely…</span> : null}
                  </label>
                ) : status === 'pending' ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Awaiting Super Admin review.</div>
                ) : null}
                    </>
                  );
                })()}
              </div>

              {/* Business Registration */}
              <div style={{ padding: 14, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                {(() => {
                  const document = agency.documents?.businessRegistration || {};
                  const status = document.status || 'not_uploaded';
                  const mayUpload = status !== 'pending' || !document.viewUrl;
                  return (
                    <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Business Registration Document</div>
                  <span className={`badge ${status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'pending' ? 'warning' : 'default'}`}>
                    {status === 'not_uploaded' ? 'Optional' : status === 'approved' ? 'Verified' : status === 'pending' ? 'Pending Super Admin Verification' : 'Rejected'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Trade licence, GSTIN or commercial transport registration document.
                </p>
                {document.viewUrl ? (
                  <a
                    href={document.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Eye size={13} /> View Registration Certificate
                  </a>
                ) : null}
                {document.submittedAt ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Submitted {new Date(document.submittedAt).toLocaleString()}</div> : null}
                {document.reviewedAt ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Reviewed {new Date(document.reviewedAt).toLocaleString()}</div> : null}
                {document.reviewedBy ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Reviewed by {document.reviewedBy}</div> : null}
                {document.rejectionReason ? <div role="alert" style={{ fontSize: 12, color: '#991b1b', marginTop: 6 }}>Reason: {document.rejectionReason}</div> : null}
                {mayUpload ? (
                  <label style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600 }}>
                    {status === 'rejected' ? 'Resubmit business document' : status === 'approved' ? 'Replace with a private vault submission' : status === 'pending' ? 'Resubmit to the private vault for review' : 'Upload optional business document'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      aria-label="Upload or resubmit business registration document"
                      disabled={uploadingDoc === 'agency-businessRegistration'}
                      onChange={(event) => handleAgencyDocumentUpload(event, 'businessRegistration')}
                      style={{ display: 'block', marginTop: 6 }}
                    />
                    {uploadingDoc === 'agency-businessRegistration' ? <span role="status">Uploading securely…</span> : null}
                  </label>
                ) : status === 'pending' ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Awaiting Super Admin review.</div>
                ) : null}
                    </>
                  );
                })()}
              </div>

              {agencyDocumentError ? <div role="alert" style={{ color: '#991b1b', background: '#fef2f2', padding: 10, borderRadius: 6 }}>{agencyDocumentError}</div> : null}

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
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {newDriver.aadhaarUrl ? `Selected: ${newDriver.aadhaarUrl}` : 'Select a local file. The document uploads after the driver account is created.'}
                  </span>
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
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {newDriver.dlUrl ? `Selected: ${newDriver.dlUrl}` : 'Select a local file. The document uploads after the driver account is created.'}
                  </span>
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
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#111827' }}>Upload Driver KYC Documents</h3>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Driver: <strong>{docModal.driverName}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => setDocModal({ open: false, driverId: null, driverName: '', aadhaarUrl: '', aadhaarFile: null, aadhaarFileName: '', aadhaarUrl_publicId: '', aadhaarUrl_resourceType: 'image', aadhaarUrl_format: 'pdf', dlUrl: '', dlFile: null, dlFileName: '', dlUrl_publicId: '', dlUrl_resourceType: 'image', dlUrl_format: 'pdf', updating: false, error: '', success: '' })}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}
              >
                &times;
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
              Upload Aadhaar card and Driving Licence files to update this driver's compliance dossier for Super Admin verification.
            </p>

            {docModal.error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                <strong>Error:</strong> {docModal.error}
              </div>
            )}

            {docModal.success && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                <strong>Success:</strong> {docModal.success}
              </div>
            )}

            <form onSubmit={handleUpdateDriverDocs} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Aadhaar File Upload */}
              <div className="form-group" style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Driver Aadhaar Card (PDF / Image) *
                </label>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                  🛡️ <strong>UIDAI Notice:</strong> Please submit a <strong>Masked Aadhaar</strong> (first 8 digits hidden).
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'aadhaarUrl', setDocModal, 'aadhaar')}
                    disabled={uploadingDoc === 'aadhaarUrl' || docModal.updating}
                    style={{ fontSize: 13 }}
                  />

                  {uploadingDoc === 'aadhaarUrl' && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      ⏳ Encrypting and uploading to private KYC vault...
                    </div>
                  )}

                  {docModal.aadhaarUrl && uploadingDoc !== 'aadhaarUrl' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#166534', background: '#dcfce7', padding: '4px 8px', borderRadius: 4, width: 'fit-content' }}>
                      <span>✓ Document ready</span>
                      {docModal.aadhaarFileName && <span style={{ color: '#374151' }}>({docModal.aadhaarFileName})</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Driving Licence File Upload */}
              <div className="form-group" style={{ padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Driver Driving Licence (PDF / Image) *
                </label>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                  Commercial transport licence or Light Motor Vehicle licence.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'dlUrl', setDocModal, 'drivingLicense')}
                    disabled={uploadingDoc === 'dlUrl' || docModal.updating}
                    style={{ fontSize: 13 }}
                  />

                  {uploadingDoc === 'dlUrl' && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      ⏳ Encrypting and uploading to private KYC vault...
                    </div>
                  )}

                  {docModal.dlUrl && uploadingDoc !== 'dlUrl' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#166534', background: '#dcfce7', padding: '4px 8px', borderRadius: 4, width: 'fit-content' }}>
                      <span>✓ Document ready</span>
                      {docModal.dlFileName && <span style={{ color: '#374151' }}>({docModal.dlFileName})</span>}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={docModal.updating || uploadingDoc !== ''}
                  onClick={() => setDocModal({ open: false, driverId: null, driverName: '', aadhaarUrl: '', aadhaarFile: null, aadhaarFileName: '', aadhaarUrl_publicId: '', aadhaarUrl_resourceType: 'image', aadhaarUrl_format: 'pdf', dlUrl: '', dlFile: null, dlFileName: '', dlUrl_publicId: '', dlUrl_resourceType: 'image', dlUrl_format: 'pdf', updating: false, error: '', success: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={docModal.updating || uploadingDoc !== '' || !docModal.aadhaarUrl || !docModal.dlUrl}
                >
                  {docModal.updating ? 'Saving Documents...' : 'Save Documents'}
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
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                Upload the RC and insurance after creating this vehicle. A driver can be assigned after both documents and the driver's identity records are approved.
              </p>

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

      {/* Modal: Assign Driver to Fleet Vehicle */}
      {assignModal.open && assignModal.vehicle && (() => {
        const v = assignModal.vehicle;
        const isRcApproved = v.documents?.registration?.status === 'approved';
        const isInsApproved = v.documents?.insurance?.status === 'approved';
        const vehicleDocsReady = isRcApproved && isInsApproved;

        const isDriverAssignable = (d) => {
          const assocStatus = d.agencyAssociation?.status || (d.agency ? (d.approvalStatus === 'approved' ? 'approved' : 'pending') : 'none');
          return (
            d.isActive !== false &&
            d.approvalStatus === 'approved' &&
            assocStatus === 'approved' &&
            d.documents?.idProof?.status === 'approved' &&
            d.documents?.drivingLicense?.status === 'approved'
          );
        };

        const eligibleDrivers = drivers.filter(isDriverAssignable);
        const currentAssignedDriver = v.driver;

        return (
          <div className="modal-backdrop" onClick={() => setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' })}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17 }}>Assign Driver to Fleet Vehicle</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    <strong>{v.vehicleNumber}</strong> &bull; {v.vehicleModel} ({v.vehicleType})
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' })}
                >
                  <X size={18} />
                </button>
              </div>

              {assignModal.error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                  {assignModal.error}
                </div>
              )}

              {/* Vehicle Compliance Section */}
              <div style={{ padding: '12px 14px', background: vehicleDocsReady ? '#f0fdf4' : '#fffbeb', border: `1px solid ${vehicleDocsReady ? '#bbf7d0' : '#fde68a'}`, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: vehicleDocsReady ? '#166534' : '#92400e', marginBottom: 6 }}>
                  {vehicleDocsReady ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  Vehicle Verification &amp; Compliance
                </div>
                <div style={{ fontSize: 12, color: vehicleDocsReady ? '#166534' : '#78350f', lineHeight: 1.5 }}>
                  {vehicleDocsReady ? (
                    'Registration Certificate (RC) and Insurance are verified and approved by Super Admin.'
                  ) : (
                    'Upload Required: Both RC and Insurance must be approved by Super Admin before driver assignment can be finalized.'
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, fontSize: 12 }}>
                  <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Registration (RC):</span>
                      <span className={`badge ${isRcApproved ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                        {v.documents?.registration?.status?.replace('_', ' ') || 'missing'}
                      </span>
                    </div>
                    {!isRcApproved && (
                      <div style={{ marginTop: 6 }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          disabled={uploadingDoc === `vehicle-${v._id}-registration`}
                          onChange={(e) => handleVehicleDocumentUpload(e, v._id, 'registration')}
                          style={{ fontSize: 11, width: '100%' }}
                        />
                        {uploadingDoc === `vehicle-${v._id}-registration` && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>Uploading...</div>}
                      </div>
                    )}
                  </div>
                  <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Insurance:</span>
                      <span className={`badge ${isInsApproved ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                        {v.documents?.insurance?.status?.replace('_', ' ') || 'missing'}
                      </span>
                    </div>
                    {!isInsApproved && (
                      <div style={{ marginTop: 6 }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          disabled={uploadingDoc === `vehicle-${v._id}-insurance`}
                          onChange={(e) => handleVehicleDocumentUpload(e, v._id, 'insurance')}
                          style={{ fontSize: 11, width: '100%' }}
                        />
                        {uploadingDoc === `vehicle-${v._id}-insurance` && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>Uploading...</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Assigned Driver Information */}
              {currentAssignedDriver && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Currently Assigned Driver:</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{currentAssignedDriver.fullName || 'Driver'}</div>
                    {currentAssignedDriver.phone && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{currentAssignedDriver.phone}</div>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ borderColor: '#ef4444', color: '#ef4444', fontSize: 12, padding: '4px 10px' }}
                    disabled={assignModal.assigning}
                    onClick={handleUnassignVehicle}
                  >
                    Unassign Driver
                  </button>
                </div>
              )}

              {/* Driver Selection Section */}
              <form onSubmit={handleAssignVehicle}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Select Eligible Driver from Your Agency *
                  </label>

                  {eligibleDrivers.length === 0 ? (
                    <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No Eligible Drivers Available</div>
                      <div>None of your agency drivers currently meet all assignment requirements:</div>
                      <ul style={{ margin: '6px 0 10px 0', paddingLeft: 20, fontSize: 12 }}>
                        <li>Agency Joining: <strong>Accepted</strong> by you (Agency Admin)</li>
                        <li>KYC Documents: <strong>Aadhaar &amp; Driving Licence</strong> approved by Super Admin</li>
                        <li>Account Status: <strong>Approved &amp; Active</strong> by Super Admin</li>
                      </ul>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' });
                          setActiveTab('drivers');
                        }}
                      >
                        Go to Drivers Tab to Review &rarr;
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {eligibleDrivers.map((d) => {
                        const conflictingVeh = vehicles.find(veh => String(veh._id) !== String(v._id) && String(veh.driver?._id || veh.driver) === String(d._id));
                        const isCurrentlyAssignedToThis = String(v.driver?._id || v.driver) === String(d._id);
                        const isSelected = assignModal.driverId === d._id;

                        return (
                          <div
                            key={d._id}
                            onClick={() => {
                              if (!conflictingVeh && !isCurrentlyAssignedToThis) {
                                setAssignModal(prev => ({ ...prev, driverId: d._id, error: '' }));
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                              background: isSelected ? 'rgba(22, 119, 255, 0.04)' : conflictingVeh || isCurrentlyAssignedToThis ? '#f9fafb' : '#fff',
                              cursor: conflictingVeh || isCurrentlyAssignedToThis ? 'not-allowed' : 'pointer',
                              opacity: conflictingVeh ? 0.65 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="radio"
                                name="assignedDriver"
                                checked={isSelected}
                                disabled={Boolean(conflictingVeh) || isCurrentlyAssignedToThis}
                                onChange={() => setAssignModal(prev => ({ ...prev, driverId: d._id, error: '' }))}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.fullName || d.user?.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {d.phone || d.user?.phone} &bull; KYC Verified
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              {isCurrentlyAssignedToThis && (
                                <span className="badge success" style={{ fontSize: 10 }}>Currently Assigned</span>
                              )}
                              {conflictingVeh && (
                                <span className="badge warning" style={{ fontSize: 10 }} title={`Assigned to ${conflictingVeh.vehicleNumber}`}>
                                  Assigned to {conflictingVeh.vehicleNumber}
                                </span>
                              )}
                              {!isCurrentlyAssignedToThis && !conflictingVeh && (
                                <span className="badge success" style={{ fontSize: 10 }}>Eligible</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={assignModal.assigning}
                    onClick={() => setAssignModal({ open: false, vehicle: null, vehicleId: null, driverId: '', assigning: false, error: '' })}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={
                      !vehicleDocsReady ||
                      !assignModal.driverId ||
                      assignModal.assigning ||
                      eligibleDrivers.length === 0 ||
                      assignModal.driverId === (v.driver?._id || v.driver)
                    }
                  >
                    {assignModal.assigning ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Driver Joining Request Approve Modal */}
      {approveModal.open && (
        <div className="modal-backdrop" onClick={() => setApproveModal({ open: false, driverId: null, driverName: '', agencyName: '', processing: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Approve Driver Joining</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setApproveModal({ open: false, driverId: null, driverName: '', agencyName: '', processing: false })}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
              Are you sure you want to approve driver <strong>{approveModal.driverName}</strong> to join <strong>{approveModal.agencyName || agency?.agencyName}</strong>?
            </p>
            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534', marginBottom: 16 }}>
              <strong>Notice:</strong> This action only approves this driver's association with your agency. Identity documents (Aadhaar &amp; Driving Licence) and final driver account activation remain pending with the Super Admin.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={approveModal.processing}
                onClick={() => setApproveModal({ open: false, driverId: null, driverName: '', agencyName: '', processing: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                disabled={approveModal.processing}
                onClick={handleConfirmApproveJoining}
              >
                {approveModal.processing ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Joining Request Reject Modal */}
      {rejectModal.open && (
        <div className="modal-backdrop" onClick={() => setRejectModal({ open: false, requestId: null, driverName: '', reason: '', processing: false })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Reject Driver Joining Request</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setRejectModal({ open: false, requestId: null, driverName: '', reason: '', processing: false })}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
              You are rejecting the joining request from <strong>{rejectModal.driverName}</strong>. A mandatory reason is required to explain this decision to the driver.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                style={{ width: '100%', fontSize: 13, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                placeholder="Explain why this request is rejected (e.g. fleet capacity reached, invalid qualifications, contact mismatch)..."
                value={rejectModal.reason}
                onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={rejectModal.processing}
                onClick={() => setRejectModal({ open: false, requestId: null, driverName: '', reason: '', processing: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={rejectModal.processing || !rejectModal.reason.trim()}
                onClick={handleRejectRequest}
              >
                {rejectModal.processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
