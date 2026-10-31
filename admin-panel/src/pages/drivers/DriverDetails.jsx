import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import driverService from '../../services/driverService';

const supportedDocuments = [
  { key: 'idProof', label: 'Identity Proof (Aadhaar)', mandatory: true },
  { key: 'drivingLicense', label: 'Driving Licence', mandatory: true }
];

export default function DriverDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Confirmation modal for account-level actions (approve, reject, suspend, toggle)
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: '', // 'approve' | 'reject' | 'suspend' | 'toggle'
    reason: '',
    error: ''
  });

  // Secure document preview modal
  const [previewModal, setPreviewModal] = useState({
    open: false,
    docLabel: '',
    viewUrl: '',
    format: '',
    maskedNumber: '',
    error: ''
  });

  const loadDriver = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await driverService.getAdminDriverById(encodeURIComponent(id));
      const record = response.data?.data?.driver;
      if (!record) throw new Error('Driver details were not returned by the API.');
      setDriver(record);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load driver details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDriver(); }, [loadDriver]);

  const reviewDocument = async (docType, action) => {
    if (reviewing) return;
    const reason = (reasons[docType] || '').trim();
    if (action === 'reject' && !reason) {
      setError('Enter a rejection reason before rejecting this document.');
      return;
    }
    setReviewing(docType);
    setError('');
    setNotice('');
    try {
      await driverService.reviewDriverDocument(encodeURIComponent(id), docType, action, reason);
      setNotice(`Document ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
      await loadDriver();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update document verification.');
    } finally {
      setReviewing('');
    }
  };

  const handleAccountAction = async () => {
    const { type, reason } = confirmModal;
    if (type === 'reject' && !reason.trim()) {
      setConfirmModal((prev) => ({ ...prev, error: 'A rejection reason is required.' }));
      return;
    }

    setActing(true);
    setError('');
    setNotice('');
    setConfirmModal((prev) => ({ ...prev, error: '' }));

    try {
      if (type === 'approve') {
        await driverService.approveDriver(encodeURIComponent(id));
        setNotice('Driver account approved successfully for active dispatch.');
      } else if (type === 'reject') {
        await driverService.rejectDriver(encodeURIComponent(id), reason.trim());
        setNotice('Driver account rejected.');
      } else if (type === 'suspend') {
        await driverService.suspendDriver(encodeURIComponent(id), reason.trim());
        setNotice('Driver account suspended.');
      } else if (type === 'toggle') {
        await driverService.toggleDriverStatus(encodeURIComponent(id), !driver.isActive);
        setNotice(`Driver account ${!driver.isActive ? 'activated' : 'deactivated'} successfully.`);
      }

      setConfirmModal({ open: false, type: '', reason: '', error: '' });
      await loadDriver();
    } catch (err) {
      setConfirmModal((prev) => ({
        ...prev,
        error: err.response?.data?.message || err.message || `Failed to ${type} driver`
      }));
    } finally {
      setActing(false);
    }
  };

  const hasAgency = Boolean(driver?.agency);
  const agencyAssocStatus = driver?.agencyAssociation?.status || (hasAgency ? 'pending' : 'none');
  const agencyAccepted = !hasAgency || agencyAssocStatus === 'approved';
  const docsApproved = driver?.documents?.idProof?.status === 'approved' && driver?.documents?.drivingLicense?.status === 'approved';
  const canApprove = Boolean(driver?.canReviewDocuments && docsApproved && agencyAccepted && driver?.approvalStatus !== 'approved');

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="btn" onClick={() => navigate('/drivers')}>&larr; Back to Drivers</button>
          <h2 className="card-title" style={{ margin: 0 }}>Driver Details &amp; KYC Verification</h2>
        </div>
        <button type="button" className="btn" onClick={loadDriver} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
      {notice && <p role="status" style={{ color: '#10b981', fontWeight: 600, marginTop: 12 }}>{notice}</p>}
      {loading && <p role="status" style={{ marginTop: 12 }}>Loading driver details…</p>}

      {!loading && driver && (
        <>
          {/* Driver Profile Summary */}
          <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: '#fafafa' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 16 }}>Profile Information</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, margin: 0 }}>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Full Name</dt>
                <dd style={{ margin: '4px 0 0 0', fontWeight: 600, fontSize: 14 }}>{driver.name || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Phone</dt>
                <dd style={{ margin: '4px 0 0 0', fontWeight: 500 }}>{driver.phone || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Email</dt>
                <dd style={{ margin: '4px 0 0 0', fontWeight: 500 }}>{driver.email || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Driver Approval</dt>
                <dd style={{ margin: '4px 0 0 0' }}>
                  <span className={`badge ${driver.approvalStatus === 'approved' ? 'success' : driver.approvalStatus === 'rejected' || driver.approvalStatus === 'suspended' ? 'danger' : 'warning'}`}>
                    {driver.approvalStatus || 'pending'}
                  </span>
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Account State</dt>
                <dd style={{ margin: '4px 0 0 0' }}>
                  <span style={{
                    color: driver.isActive ? '#166534' : '#991b1b',
                    background: driver.isActive ? '#dcfce7' : '#fee2e2',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {driver.isActive ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Online Status</dt>
                <dd style={{ margin: '4px 0 0 0' }}>
                  <span style={{
                    color: driver.isOnline ? '#166534' : '#6b7280',
                    background: driver.isOnline ? '#dcfce7' : '#f3f4f6',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {driver.isOnline ? 'Online' : 'Offline'}
                  </span>
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Registered Date</dt>
                <dd style={{ margin: '4px 0 0 0', fontWeight: 500 }}>
                  {driver.createdAt ? new Date(driver.createdAt).toLocaleString() : '—'}
                </dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 }}>Selected Agency</dt>
                <dd style={{ margin: '4px 0 0 0', fontWeight: 500 }}>
                  {driver.agency?.agencyName
                    ? `${driver.agency.agencyName} (ID: ${driver.agency._id || driver.agency.id})`
                    : 'Independent Driver'}
                </dd>
              </div>
            </dl>

            {driver.rejectionReason && (
              <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 13 }}>
                <strong>Account Rejection / Suspension Reason:</strong> {driver.rejectionReason}
              </div>
            )}
          </div>

          {/* Assigned Vehicles */}
          <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: '#fafafa' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Assigned Fleet Vehicles</h3>
            {(driver.vehicles || []).length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No vehicle currently assigned to this driver.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {driver.vehicles.map((v) => (
                  <div key={v.id || v._id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.vehicleNumber}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {v.vehicleModel} · {v.vehicleType} · {v.loadCapacity}kg
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 8 }}>
                      <span style={{ color: v.isAvailable ? '#166534' : '#991b1b' }}>
                        {v.isAvailable ? 'Available' : 'Busy / On Trip'}
                      </span>
                      <span>·</span>
                      <span style={{ color: v.isActive ? '#166534' : '#6b7280' }}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 4, marginTop: 10, fontSize: 12 }}>
                      {[
                        { key: 'registration', label: 'Vehicle RC' },
                        { key: 'insurance', label: 'Vehicle Insurance' }
                      ].map(({ key, label }) => {
                        const document = v.documents?.[key] || { status: 'not_uploaded' };
                        return (
                          <div key={key}>
                            <strong>{label}:</strong> {document.status || 'not_uploaded'}
                            {document.submittedAt ? ` · Submitted ${new Date(document.submittedAt).toLocaleDateString()}` : ''}
                            {document.rejectionReason ? ` · Rejection: ${document.rejectionReason}` : ''}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/vehicles/${encodeURIComponent(v.id || v._id)}`)}
                        style={{ justifySelf: 'start', marginTop: 4 }}
                      >
                        Review Vehicle Documents
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 1. Stage 1: Related Agency Admin Association Review */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: '#f9fafb' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Stage 1: Agency Association Status</h3>
            {hasAgency ? (
              <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 8, margin: 0 }}>
                <dt style={{ fontWeight: 600 }}>Agency Name &amp; ID</dt>
                <dd style={{ margin: 0 }}>{driver.agency.agencyName} ({driver.agency._id || driver.agency.id})</dd>

                <dt style={{ fontWeight: 600 }}>Association Status</dt>
                <dd style={{ margin: 0 }}>
                  <span className={`badge ${agencyAssocStatus === 'approved' ? 'success' : agencyAssocStatus === 'rejected' ? 'danger' : 'warning'}`}>
                    {agencyAssocStatus === 'approved' ? 'Accepted by Agency Admin' : agencyAssocStatus === 'rejected' ? 'Rejected by Agency Admin' : 'Pending Agency Admin Review'}
                  </span>
                </dd>

                {driver.agencyAssociation?.decidedAt && (
                  <>
                    <dt style={{ fontWeight: 600 }}>Decision Date</dt>
                    <dd style={{ margin: 0 }}>{new Date(driver.agencyAssociation.decidedAt).toLocaleString()}</dd>
                  </>
                )}

                {driver.agencyAssociation?.reviewedBy && (
                  <>
                    <dt style={{ fontWeight: 600 }}>Reviewer</dt>
                    <dd style={{ margin: 0 }}>
                      {typeof driver.agencyAssociation.reviewedBy === 'object'
                        ? `${driver.agencyAssociation.reviewedBy.name || 'Agency Admin'} (${driver.agencyAssociation.reviewedBy._id || ''})`
                        : driver.agencyAssociation.reviewedBy}
                    </dd>
                  </>
                )}

                {agencyAssocStatus === 'rejected' && driver.agencyAssociation?.rejectionReason && (
                  <>
                    <dt style={{ fontWeight: 600, color: '#dc2626' }}>Agency Rejection Reason</dt>
                    <dd style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>{driver.agencyAssociation.rejectionReason}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Independent Driver &mdash; No agency association required.
              </p>
            )}

            {hasAgency && agencyAssocStatus === 'pending' && (
              <div style={{ marginTop: 10, padding: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                Pending association decision from the agency owner. Final Super Admin approval requires prior agency acceptance.
              </div>
            )}
            {hasAgency && agencyAssocStatus === 'rejected' && (
              <div style={{ marginTop: 10, padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
                The selected agency rejected this driver association. Final driver approval cannot be granted.
              </div>
            )}
          </div>

          {/* 2. Stage 2: Super Admin KYC Documents Review */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16 }}>Stage 2: Required Identity &amp; Compliance Documents (KYC)</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Final driver approval requires both Identity Proof (Aadhaar) and Driving Licence to be approved by Super Admin.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {supportedDocuments.map(({ key, label, mandatory }) => {
                const document = driver.documents?.[key] || { status: 'not_uploaded' };
                const submitted = Boolean(document.status && document.status !== 'not_uploaded' && document.status !== 'missing');
                const status = submitted ? (document.status || 'pending') : 'missing';
                const busy = reviewing === key;

                return (
                  <article
                    key={key}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 16,
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{label}</strong>
                          <div style={{ fontSize: 11, color: mandatory ? '#b45309' : '#6b7280', fontWeight: 500, marginTop: 2 }}>
                            {mandatory ? 'Mandatory Requirement' : 'Optional Document'}
                          </div>
                        </div>
                        <span className={`badge ${status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'pending' ? 'warning' : ''}`} style={{ background: status === 'missing' ? '#f3f4f6' : undefined, color: status === 'missing' ? '#6b7280' : undefined }}>
                          {status === 'missing' ? 'Missing' : status}
                        </span>
                      </div>

                      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 120px) 1fr', gap: 6, margin: '10px 0', fontSize: 12 }}>
                        <dt style={{ color: 'var(--text-secondary)' }}>Submitted:</dt>
                        <dd style={{ margin: 0 }}>{document.submittedAt ? new Date(document.submittedAt).toLocaleString() : 'Not submitted yet'}</dd>
                        {document.uploadedBy ? (
                          <>
                            <dt style={{ color: 'var(--text-secondary)' }}>Uploaded by:</dt>
                            <dd style={{ margin: 0 }}>{typeof document.uploadedBy === 'object' ? document.uploadedBy.name : document.uploadedBy}</dd>
                          </>
                        ) : null}
                        {document.reviewedAt ? (
                          <>
                            <dt style={{ color: 'var(--text-secondary)' }}>Reviewed:</dt>
                            <dd style={{ margin: 0 }}>{new Date(document.reviewedAt).toLocaleString()}</dd>
                          </>
                        ) : null}
                        {document.reviewedBy ? (
                          <>
                            <dt style={{ color: 'var(--text-secondary)' }}>Reviewer:</dt>
                            <dd style={{ margin: 0 }}>{typeof document.reviewedBy === 'object' ? document.reviewedBy.name : document.reviewedBy}</dd>
                          </>
                        ) : null}
                      </dl>

                      {document.rejectionReason && (
                        <div style={{ margin: '8px 0', padding: 8, background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>
                          <strong>Rejection reason:</strong> {document.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                      {document.viewUrl ? (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPreviewModal({
                              open: true,
                              docLabel: label,
                              viewUrl: document.viewUrl,
                              format: document.format || 'pdf',
                              maskedNumber: document.maskedNumber || '',
                              error: ''
                            })}
                          >
                            Preview Securely
                          </button>
                          <a
                            href={document.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            Open in Tab &rarr;
                          </a>
                        </div>
                      ) : submitted ? (
                        <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 8px 0' }}>
                          Legacy document not stored in the private review vault. Ask driver to resubmit.
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', margin: '0 0 8px 0' }}>
                          Document has not been uploaded.
                        </p>
                      )}

                      {driver.canReviewDocuments && document.viewUrl && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          <label style={{ fontSize: 12 }}>
                            Rejection reason (required if rejecting):
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={reasons[key] || ''}
                              onChange={(event) => setReasons((curr) => ({ ...curr, [key]: event.target.value }))}
                              placeholder="e.g. Image blurry, name does not match, or document expired."
                              style={{ width: '100%', fontSize: 12, marginTop: 4, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={Boolean(reviewing) || document.status === 'approved'}
                              onClick={() => reviewDocument(key, 'approve')}
                            >
                              {busy ? 'Saving…' : 'Approve Document'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ background: '#fee2e2', color: '#991b1b' }}
                              disabled={Boolean(reviewing) || document.status === 'rejected'}
                              onClick={() => reviewDocument(key, 'reject')}
                            >
                              Reject &amp; Request Re-upload
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 3. Stage 3: Super Admin Driver Final Approval Actions */}
          <div style={{ marginTop: 28, padding: 20, border: '1px solid var(--border)', borderRadius: 8, background: '#fafafa' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Stage 3: Super Admin Final Driver Approval</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Final driver approval activates the driver for platform dispatch. Only the designated Super Admin can execute this action.
            </p>

            {driver.canReviewDocuments ? (
              <div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={acting || !canApprove}
                    onClick={() => setConfirmModal({ open: true, type: 'approve', reason: '', error: '' })}
                  >
                    {acting ? 'Processing…' : 'Approve Driver (Final)'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#fee2e2', color: '#991b1b' }}
                    disabled={acting || driver.approvalStatus === 'rejected'}
                    onClick={() => setConfirmModal({ open: true, type: 'reject', reason: driver.rejectionReason || '', error: '' })}
                  >
                    Reject Driver
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={acting || driver.approvalStatus === 'suspended'}
                    onClick={() => setConfirmModal({ open: true, type: 'suspend', reason: '', error: '' })}
                  >
                    Suspend Driver
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={acting}
                    onClick={() => setConfirmModal({ open: true, type: 'toggle', reason: '', error: '' })}
                  >
                    {driver.isActive ? 'Deactivate Account' : 'Activate Account'}
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  {!docsApproved && (
                    <p style={{ fontSize: 12, color: '#f59e0b', margin: '4px 0' }}>
                      ⚠️ Driver cannot be approved until both Aadhaar and Driving Licence are approved by Super Admin.
                    </p>
                  )}
                  {hasAgency && !agencyAccepted && (
                    <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0' }}>
                      ⚠️ Driver cannot be approved until the agency owner accepts the driver joining request.
                    </p>
                  )}
                  {driver.approvalStatus === 'approved' && (
                    <p style={{ fontSize: 12, color: '#166534', margin: '4px 0' }}>
                      ✓ Driver is fully approved for active dispatch.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                You are viewing driver details in read-only mode. Only the designated Super Admin has authority to review KYC documents or finalize driver approval.
              </p>
            )}
          </div>
        </>
      )}

      {/* Confirmation & Reason Modal */}
      {confirmModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 460, margin: 16 }}>
            <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>
              {confirmModal.type === 'toggle'
                ? (driver?.isActive ? 'Deactivate Account' : 'Activate Account')
                : `${confirmModal.type} Driver`}
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Driver: <strong>{driver?.name}</strong> (Phone: {driver?.phone})
            </p>

            {confirmModal.type === 'approve' && (
              <p style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: 10, borderRadius: 6 }}>
                Are you sure you want to grant final approval for this driver? All required identity documents and agency association checks are satisfied.
              </p>
            )}

            {confirmModal.type === 'suspend' && (
              <p style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 6 }}>
                Suspending this driver will immediately take them offline and block them from accepting bookings.
              </p>
            )}

            {confirmModal.type === 'toggle' && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Are you sure you want to {driver?.isActive ? 'deactivate' : 'activate'} this driver account?
                {driver?.isActive ? ' The driver will be taken offline immediately.' : ''}
              </p>
            )}

            {(confirmModal.type === 'reject' || confirmModal.type === 'suspend') && (
              <div style={{ marginTop: 12 }}>
                <label htmlFor="driver-confirm-reason" style={{ fontWeight: 600, fontSize: 13 }}>
                  {confirmModal.type === 'reject' ? 'Rejection Reason (Required):' : 'Suspension Reason (Optional):'}
                </label>
                <textarea
                  id="driver-confirm-reason"
                  maxLength={500}
                  required={confirmModal.type === 'reject'}
                  placeholder={confirmModal.type === 'reject' ? 'e.g. Expired Driving Licence or blurred document scan.' : 'e.g. Customer safety complaint or violation of terms.'}
                  value={confirmModal.reason}
                  onChange={(e) => setConfirmModal({ ...confirmModal, reason: e.target.value })}
                  style={{ width: '100%', minHeight: 80, marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                />
              </div>
            )}

            {confirmModal.error && (
              <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>
                {confirmModal.error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                disabled={acting}
                onClick={() => setConfirmModal({ open: false, type: '', reason: '', error: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={acting || (confirmModal.type === 'reject' && !confirmModal.reason.trim())}
                style={{
                  background: confirmModal.type === 'approve'
                    ? 'var(--primary)'
                    : confirmModal.type === 'reject' || confirmModal.type === 'suspend'
                      ? 'var(--danger)'
                      : undefined,
                  color: confirmModal.type !== 'toggle' ? '#fff' : undefined
                }}
                onClick={handleAccountAction}
              >
                {acting ? 'Saving…' : `Confirm ${confirmModal.type[0].toUpperCase() + confirmModal.type.slice(1)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Document Preview Modal */}
      {previewModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
          <div className="card" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{previewModal.docLabel}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Driver: <strong>{driver?.name}</strong>
                  {previewModal.maskedNumber ? ` · Number: ${previewModal.maskedNumber}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPreviewModal({ open: false, docLabel: '', viewUrl: '', format: '', maskedNumber: '', error: '' })}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 320, maxHeight: 520, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 8, padding: 12 }}>
              {previewModal.viewUrl ? (
                previewModal.format === 'pdf' || previewModal.viewUrl.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={previewModal.viewUrl}
                    style={{ width: '100%', height: '480px', border: 'none', borderRadius: 6 }}
                    title="Document PDF Preview"
                  />
                ) : (
                  <img
                    src={previewModal.viewUrl}
                    alt={previewModal.docLabel}
                    style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: 6 }}
                  />
                )
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No preview available.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 11, color: '#b45309' }}>
                🔒 Short-lived authenticated URL (expires in 5 minutes)
              </span>
              <a
                href={previewModal.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Open in New Tab &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
