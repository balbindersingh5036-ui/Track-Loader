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
  const [newDriver, setNewDriver] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [newDriverModal, setNewDriverModal] = useState(false);
  const [docModal, setDocModal] = useState({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '' });

  const [newVehicle, setNewVehicle] = useState({
    driverId: '',
    vehicleNumber: '',
    vehicleModel: '',
    vehicleType: 'mini-truck',
    loadCapacityValue: 1000,
    loadCapacityUnit: 'kg',
    bodyType: 'closed',
    vehicleImage: ''
  });
  const [newVehicleModal, setNewVehicleModal] = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, vehicleId: null, driverId: '' });
  const [uploadingDoc, setUploadingDoc] = useState('');

  const handleFileUpload = async (e, targetField, setter, purpose = 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDoc(targetField);
      const res = await agencyService.uploadFile(file, purpose);
      const url = res.data?.imageUrl || res.data?.url;
      setter(prev => ({ ...prev, [targetField]: url }));
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
          businessRegistration: { url: regForm.businessRegUrl, status: 'pending' },
          ownerAadhaar: { url: regForm.ownerAadhaarUrl, status: 'pending' }
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
      await agencyService.createAgencyDriver(newDriver);
      setNewDriver({ fullName: '', phone: '', email: '', password: '' });
      setNewDriverModal(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to register driver');
    }
  };

  const handleUpdateDriverDocs = async (e) => {
    e.preventDefault();
    try {
      await agencyService.updateDriverDocuments(docModal.driverId, {
        idProof: { url: docModal.aadhaarUrl, status: 'pending' },
        drivingLicense: { url: docModal.dlUrl, status: 'pending' }
      });
      setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '' });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update documents');
    }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      await agencyService.createAgencyVehicle({
        driverId: newVehicle.driverId,
        vehicleNumber: newVehicle.vehicleNumber,
        vehicleModel: newVehicle.vehicleModel,
        vehicleType: newVehicle.vehicleType,
        loadCapacity: { value: Number(newVehicle.loadCapacityValue), unit: newVehicle.loadCapacityUnit },
        bodyType: newVehicle.bodyType
      });
      setNewVehicle({
        driverId: '',
        vehicleNumber: '',
        vehicleModel: '',
        vehicleType: 'mini-truck',
        loadCapacityValue: 1000,
        loadCapacityUnit: 'kg',
        bodyType: 'closed'
      });
      setNewVehicleModal(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to add vehicle');
    }
  };

  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    try {
      await agencyService.assignVehicleDriver(assignModal.vehicleId, assignModal.driverId);
      setAssignModal({ open: false, vehicleId: null, driverId: '' });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to assign driver');
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileUpload(e, 'ownerAadhaarUrl', setRegForm, 'aadhaar')}
              />
              {uploadingDoc === 'ownerAadhaarUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
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
        background: agency.approvalStatus === 'approved' ? '#f0fdf4' : agency.approvalStatus === 'rejected' ? '#fef2f2' : '#fffbeb',
        borderColor: agency.approvalStatus === 'approved' ? '#bbf7d0' : agency.approvalStatus === 'rejected' ? '#fecaca' : '#fef08a'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: '#111827' }}>{agency.agencyName}</h2>
            <div style={{ fontSize: 14, color: '#4b5563' }}>
              Verification Status: <strong style={{
                textTransform: 'uppercase',
                color: agency.approvalStatus === 'approved' ? '#166534' : agency.approvalStatus === 'rejected' ? '#991b1b' : '#854d0e'
              }}>
                {agency.approvalStatus}
              </strong>
              {agency.approvalStatus === 'approved' && ' — Approved by Super Admin. Fleet is active for dispatches.'}
              {agency.approvalStatus === 'pending' && ' — Under Super Admin review. You can add drivers and vehicles while pending.'}
              {agency.approvalStatus === 'rejected' && ' — Verification rejected. Please review feedback.'}
            </div>
          </div>
          <span style={{
            background: agency.approvalStatus === 'approved' ? '#dcfce7' : agency.approvalStatus === 'rejected' ? '#fee2e2' : '#fef9c3',
            color: agency.approvalStatus === 'approved' ? '#166534' : agency.approvalStatus === 'rejected' ? '#991b1b' : '#854d0e',
            padding: '6px 14px', borderRadius: 20, fontWeight: 'bold', fontSize: 13, textTransform: 'capitalize'
          }}>
            {agency.approvalStatus}
          </span>
        </div>

        {agency.rejectionReason && (
          <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
            <strong>Rejection reason:</strong> {agency.rejectionReason}
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
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <div>Aadhaar: {d.documents?.idProof?.url ? <span style={{ color: '#166534' }}>Uploaded</span> : <span style={{ color: '#991b1b' }}>Missing</span>}</div>
                          <div>Licence: {d.documents?.drivingLicense?.url ? <span style={{ color: '#166534' }}>Uploaded</span> : <span style={{ color: '#991b1b' }}>Missing</span>}</div>
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
                            dlUrl: d.documents?.drivingLicense?.url || ''
                          })}
                        >
                          Upload KYC Docs
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
              No fleet vehicles added yet.
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Assigned Driver</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v._id}>
                      <td style={{ fontWeight: 600 }}>{v.vehicleNumber}</td>
                      <td>{v.vehicleModel}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.vehicleType}</td>
                      <td>{v.loadCapacity?.value} {v.loadCapacity?.unit}</td>
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
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setAssignModal({ open: true, vehicleId: v._id, driverId: v.driver?._id || '' })}
                        >
                          Reassign Driver
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
              {agency.documents?.ownerAadhaar?.url ? (
                <a href={agency.documents.ownerAadhaar.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                  View Submitted Aadhaar
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
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 440 }}>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setNewDriverModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Driver</button>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, 'aadhaarUrl', setDocModal, 'aadhaar')}
                  />
                  {uploadingDoc === 'aadhaarUrl' && <span style={{ fontSize: 12, color: 'var(--primary)' }}>Uploading…</span>}
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
                <button type="button" className="btn" onClick={() => setDocModal({ open: false, driverId: null, aadhaarUrl: '', dlUrl: '' })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Documents</button>
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
                    <option value="closed">Closed / Container</option>
                    <option value="tarpaulin">Tarpaulin</option>
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
                <button type="submit" className="btn btn-primary">Add Vehicle</button>
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
                <button type="button" className="btn" onClick={() => setAssignModal({ open: false, vehicleId: null, driverId: '' })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
