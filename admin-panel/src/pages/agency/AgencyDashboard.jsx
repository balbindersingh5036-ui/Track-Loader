import React, { useEffect, useState } from 'react';
import agencyService from '../../services/agencyService';

export default function AgencyDashboard() {
  const [agency, setAgency] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, drivers, vehicles, bookings, profile

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      try {
        const agRes = await agencyService.getMyAgency();
        setAgency(agRes.data.data.agency);
      } catch (err) {
        if (err.response?.status === 404) {
          setAgency(null);
          setLoading(false);
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
    return <section className="card"><p role="status">Loading Agency Dashboard...</p></section>;
  }

  // If user has not yet registered an agency
  if (!agency) {
    return (
      <section className="card" style={{ maxWidth: 650, margin: '40px auto' }}>
        <h2 className="card-title">Register Your Transport Agency</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Register your fleet agency to manage commercial vehicles and assign approved drivers. Once submitted, your registration and Aadhaar will be reviewed by Super Admin.
        </p>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleRegisterAgency} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Agency Name *</label>
            <input
              type="text"
              required
              value={regForm.agencyName}
              onChange={(e) => setRegForm({ ...regForm, agencyName: e.target.value })}
              placeholder="e.g. Speedy Transport Fleet"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="text"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                placeholder="e.g. +919876543210"
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
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
              🛡️ <strong>Privacy Notice:</strong> For regulatory compliance, please upload a <strong>Masked Aadhaar</strong> (first 8 digits hidden, showing only last 4 digits). Documents are encrypted and accessible only via short-lived authenticated links.
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
              placeholder="Or enter URL: https://.../owner-aadhaar.pdf"
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

          <button type="submit" className="btn btn-primary" disabled={registering} style={{ marginTop: 12 }}>
            {registering ? 'Submitting Registration...' : 'Submit Agency for Super Admin Review'}
          </button>
        </form>
      </section>
    );
  }

  // Agency exists: Display Full Agency Dashboard
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Agency Status Banner */}
      <section className="card" style={{
        background: agency.approvalStatus === 'approved' ? '#f0fdf4' : agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#fef2f2' : '#fffbeb',
        borderColor: agency.approvalStatus === 'approved' ? '#bbf7d0' : agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#fecaca' : '#fef08a'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: '#111827' }}>{agency.agencyName}</h2>
            <div style={{ fontSize: 14, color: '#4b5563' }}>
              Verification Status: <strong style={{
                textTransform: 'uppercase',
                color: agency.approvalStatus === 'approved' ? '#166534' : agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#991b1b' : '#854d0e'
              }}>
                {agency.approvalStatus}
              </strong>
              {agency.approvalStatus === 'approved' && ' — Approved by Super Admin. Fleet is active for dispatches.'}
              {agency.approvalStatus === 'pending' && ' — Under Super Admin review. You can add drivers and vehicles while pending verification.'}
              {agency.approvalStatus === 'rejected' && ' — Verification rejected by Super Admin. Please review feedback.'}
              {agency.approvalStatus === 'suspended' && ' — Account suspended by Super Admin. Fleet operations are paused.'}
            </div>
          </div>
          <span style={{
            background: agency.approvalStatus === 'approved' ? '#dcfce7' : agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#fee2e2' : '#fef9c3',
            color: agency.approvalStatus === 'approved' ? '#166534' : agency.approvalStatus === 'rejected' || agency.approvalStatus === 'suspended' ? '#991b1b' : '#854d0e',
            padding: '6px 14px', borderRadius: 20, fontWeight: 'bold', fontSize: 13, textTransform: 'capitalize'
          }}>
            {agency.approvalStatus}
          </span>
        </div>

        {agency.rejectionReason && (
          <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
            <strong>Reason:</strong> {agency.rejectionReason}
          </div>
        )}
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        {['overview', 'drivers', 'vehicles', 'bookings', 'profile'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn ${activeTab === tab ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: 'var(--primary)' }}>{drivers.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Registered Drivers</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#10b981' }}>{vehicles.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Fleet Vehicles</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#f59e0b' }}>
                {drivers.filter(d => d.approvalStatus === 'approved').length}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Approved Drivers</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#6366f1' }}>{bookings.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Fleet Trips</div>
            </div>
          </div>

          <section className="card">
            <h3 style={{ marginTop: 0 }}>Agency Operations Notice</h3>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
              <li><strong>Super Admin Authority:</strong> Only Super Admin can approve, reject or suspend drivers. Submitted drivers will remain in <code>pending</code> status until verified.</li>
              <li><strong>Booking Dispatch Eligibility:</strong> Vehicles will only receive customer booking requests or same-type alternative dispatch when the assigned driver is approved by Super Admin and online.</li>
              <li><strong>Data Isolation:</strong> Your drivers and fleet vehicles are strictly isolated to your agency account.</li>
            </ul>
          </section>
        </div>
      )}

      {/* TAB 2: DRIVERS */}
      {activeTab === 'drivers' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Agency Drivers ({drivers.length})</h3>
            <button type="button" className="btn btn-primary" onClick={() => setNewDriverModal(true)}>
              + Register Driver
            </button>
          </div>

          {drivers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
              No drivers added yet. Click "+ Register Driver" to add your first driver.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>Phone</th>
                    <th>Super Admin Status</th>
                    <th>Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d._id}>
                      <td style={{ fontWeight: 600 }}>{d.fullName || d.user?.name}</td>
                      <td>{d.phone || d.user?.phone}</td>
                      <td>
                        <span style={{
                          background: d.approvalStatus === 'approved' ? '#dcfce7' : d.approvalStatus === 'rejected' ? '#fee2e2' : '#fef9c3',
                          color: d.approvalStatus === 'approved' ? '#166534' : d.approvalStatus === 'rejected' ? '#991b1b' : '#854d0e',
                          padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize'
                        }}>
                          {d.approvalStatus}
                        </span>
                        {d.approvalStatus === 'rejected' && d.rejectionReason && (
                          <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>
                            <strong>Reason:</strong> {d.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
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
                          className="btn"
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
        </section>
      )}

      {/* TAB 3: VEHICLES */}
      {activeTab === 'vehicles' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Fleet Vehicles ({vehicles.length})</h3>
            <button
              type="button"
              className="btn btn-primary"
              disabled={drivers.length === 0}
              onClick={() => setNewVehicleModal(true)}
            >
              + Add Vehicle
            </button>
          </div>

          {drivers.length === 0 && (
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>
              * You must register at least one driver before adding fleet vehicles.
            </p>
          )}

          {vehicles.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
              No fleet vehicles added yet. Click "+ Add Vehicle" to add your first vehicle.
            </p>
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
                  {vehicles.map((v) => (
                    <tr key={v._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {v.vehicleImage && (
                            <img
                              src={v.vehicleImage}
                              alt={v.vehicleNumber}
                              style={{ width: 40, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }}
                            />
                          )}
                          <span style={{ fontWeight: 600 }}>{v.vehicleNumber}</span>
                        </div>
                      </td>
                      <td>{v.vehicleModel}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.vehicleType}</td>
                      <td>{v.loadCapacity?.value} {v.loadCapacity?.unit}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.bodyType || 'open'}</td>
                      <td>
                        {v.driver?.fullName ? (
                          <div>
                            <div>{v.driver.fullName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status: {v.driver.approvalStatus}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--danger)' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: v.isAvailable ? '#166534' : '#991b1b', fontWeight: 600, fontSize: 12 }}>
                          {v.isAvailable ? 'Available' : 'On Trip'}
                        </span>
                        {!v.isActive && (
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--danger)' }}>Inactive</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn"
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
                            className="btn"
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
        </section>
      )}

      {/* TAB 4: BOOKINGS */}
      {activeTab === 'bookings' && (
        <section className="card">
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Fleet Trips & Bookings ({bookings.length})</h3>
          {bookings.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
              No customer bookings assigned to your fleet yet.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Vehicle / Type</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id}>
                      <td style={{ fontWeight: 600 }}>{b.bookingId}</td>
                      <td>{b.customer?.name || '—'} ({b.customer?.phone || '—'})</td>
                      <td>{b.vehicle?.vehicleNumber || b.vehicleType}</td>
                      <td>{b.driver?.fullName || 'Pending'}</td>
                      <td>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 12 }}>
                          {b.bookingStatus}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹{b.finalFare || b.estimatedFare || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 5: PROFILE */}
      {activeTab === 'profile' && (
        <section className="card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginTop: 0 }}>Agency Profile & KYC Status</h3>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <dt style={{ fontWeight: 600 }}>Agency Name:</dt>
            <dd style={{ margin: 0 }}>{agency.agencyName}</dd>
            <dt style={{ fontWeight: 600 }}>Phone:</dt>
            <dd style={{ margin: 0 }}>{agency.phone}</dd>
            <dt style={{ fontWeight: 600 }}>Email:</dt>
            <dd style={{ margin: 0 }}>{agency.email || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Address:</dt>
            <dd style={{ margin: 0 }}>{agency.address || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>City:</dt>
            <dd style={{ margin: 0 }}>{agency.city || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Aadhaar Doc:</dt>
            <dd style={{ margin: 0 }}>
              {(agency.documents?.ownerAadhaar?.viewUrl || agency.documents?.ownerAadhaar?.url) ? (
                <a href={agency.documents.ownerAadhaar.viewUrl || agency.documents.ownerAadhaar.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                  View Submitted Aadhaar (Authorized Link)
                </a>
              ) : 'Not submitted'}
            </dd>
          </dl>
        </section>
      )}

      {/* Modal: Register Driver */}
      {newDriverModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Register New Driver</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Driver will be registered under your agency. Super Admin approval is required before the driver can accept bookings.
            </p>
            <form onSubmit={handleCreateDriver} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  value={newDriver.fullName}
                  onChange={(e) => setNewDriver({ ...newDriver, fullName: e.target.value })}
                  placeholder="Driver full name"
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
                <label>Driver Address</label>
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
                    placeholder="Or enter URL: https://.../driver-aadhaar.pdf"
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
                    placeholder="Or enter URL: https://.../driver-dl.pdf"
                    style={{ fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setNewDriverModal(false)}>Cancel</button>
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
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>Upload Driver Documents</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Enter secure document URLs for Driver Aadhaar and Driving Licence.
            </p>
            <form onSubmit={handleUpdateDriverDocs} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Driver Aadhaar Card (PDF or Image)</label>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  🛡️ <strong>UIDAI Notice:</strong> Please submit a <strong>Masked Aadhaar</strong> (first 8 digits hidden). Stored in private vault with authorized delivery.
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
                <button type="button" className="btn" onClick={() => setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '', updating: false })}>
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
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>Add Fleet Vehicle</h3>
            <form onSubmit={handleCreateVehicle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Assign Driver *</label>
                <select
                  required
                  value={newVehicle.driverId}
                  onChange={(e) => setNewVehicle({ ...newVehicle, driverId: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                >
                  <option value="">Select a driver...</option>
                  {drivers.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.fullName || d.user?.name} ({d.approvalStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.vehicleNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value })}
                    placeholder="PB10AB1234"
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Model *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.vehicleModel}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleModel: e.target.value })}
                    placeholder="Tata 407 / Bolero"
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
                <button type="button" className="btn" onClick={() => setNewVehicleModal(false)}>Cancel</button>
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
            <h3 style={{ marginTop: 0 }}>Edit Fleet Vehicle</h3>
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
                  className="btn"
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
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>Assign Driver to Vehicle</h3>
            <form onSubmit={handleAssignVehicle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Select Driver *</label>
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
                <button type="button" className="btn" onClick={() => setAssignModal({ open: false, vehicleId: null, driverId: '', assigning: false })}>
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
