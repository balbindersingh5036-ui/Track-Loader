import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const requiredDocuments = [
  { key: 'drivingLicense', label: 'Driving Licence' },
  { key: 'idProof', label: 'Identity Proof (Aadhaar)' }
];

export default function DriverDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [reasons, setReasons] = useState({});
  const [driverActionReason, setDriverActionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDriver = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/drivers/${encodeURIComponent(id)}`);
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

  const review = async (docType, action) => {
    if (reviewing) return;
    const reason = (reasons[docType] || '').trim();
    if (action === 'reject' && !reason) {
      setError('Enter a reason before rejecting this document.');
      return;
    }
    setReviewing(docType);
    setError('');
    setNotice('');
    try {
      await api.patch(
        `/admin/drivers/${encodeURIComponent(id)}/documents/${docType}/${action}`,
        action === 'reject' ? { reason } : {}
      );
      setNotice(`${docType === 'idProof' ? 'Identity Proof' : 'Driving Licence'} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await loadDriver();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update document verification.');
    } finally {
      setReviewing('');
    }
  };

  const handleDriverApproval = async (action) => {
    if (acting) return;
    setError('');
    setNotice('');
    if (action === 'reject' && !driverActionReason.trim()) {
      setError('Enter a reason before rejecting the driver account.');
      return;
    }
    setActing(true);
    try {
      await api.patch(
        `/admin/drivers/${encodeURIComponent(id)}/${action}`,
        action === 'reject' || action === 'suspend' ? { reason: driverActionReason.trim() } : {}
      );
      setNotice(`Driver account ${action}ed successfully.`);
      setDriverActionReason('');
      await loadDriver();
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to ${action} driver`);
    } finally {
      setActing(false);
    }
  };

  const hasAgency = Boolean(driver?.agency);
  const agencyAssocStatus = driver?.agencyAssociation?.status || (hasAgency ? 'pending' : 'none');
  const agencyAccepted = !hasAgency || agencyAssocStatus === 'approved';
  const docsApproved = driver?.documents?.idProof?.status === 'approved' && driver?.documents?.drivingLicense?.status === 'approved';
  const canApprove = driver?.canReviewDocuments && docsApproved && agencyAccepted && driver?.approvalStatus !== 'approved';

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>
        <h2 className="card-title">Driver details &amp; KYC review</h2>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {notice && <p role="status" style={{ color: '#10b981', fontWeight: 600 }}>{notice}</p>}
      {loading && <p role="status">Loading driver details…</p>}
      {!loading && driver && (
        <>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 12 }}>
            <dt style={{ fontWeight: 700 }}>Name</dt><dd style={{ margin: 0 }}>{driver.name || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Phone</dt><dd style={{ margin: 0 }}>{driver.phone || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Email</dt><dd style={{ margin: 0 }}>{driver.email || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Driver approval</dt>
            <dd style={{ margin: 0, textTransform: 'capitalize' }}>
              <span className={`badge ${driver.approvalStatus === 'approved' ? 'success' : driver.approvalStatus === 'rejected' || driver.approvalStatus === 'suspended' ? 'danger' : 'warning'}`}>
                {driver.approvalStatus || 'pending'}
              </span>
            </dd>
            <dt style={{ fontWeight: 700 }}>Account status</dt><dd style={{ margin: 0 }}>{driver.isActive ? 'Active' : 'Inactive'}</dd>
            <dt style={{ fontWeight: 700 }}>Agency</dt>
            <dd style={{ margin: 0 }}>
              {driver.agency?.agencyName
                ? `${driver.agency.agencyName} (ID: ${driver.agency._id || driver.agency.id})`
                : 'Independent Driver'}
            </dd>
            {driver.rejectionReason && (
              <>
                <dt style={{ fontWeight: 700, color: '#dc2626' }}>Rejection reason</dt>
                <dd style={{ margin: 0, color: '#dc2626' }}>{driver.rejectionReason}</dd>
              </>
            )}
            <dt style={{ fontWeight: 700 }}>Vehicles</dt>
            <dd style={{ margin: 0 }}>{(driver.vehicles || []).map((vehicle) => `${vehicle.vehicleNumber} (${vehicle.vehicleModel})`).join(', ') || '—'}</dd>
          </dl>

          {/* 1. First Approval: Related Agency Admin Association Review */}
          <div style={{ marginTop: 24, padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: '#f9fafb' }}>
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
          <h3 style={{ marginTop: 28 }}>Stage 2: Required identity documents (KYC)</h3>
          <p>Driver approval is only available after both identity documents have been approved by the Super Admin.</p>
          <div style={{ display: 'grid', gap: 14 }}>
            {requiredDocuments.map(({ key, label }) => {
              const document = driver.documents?.[key] || { status: 'not_uploaded' };
              const status = document.status || 'not_uploaded';
              const busy = reviewing === key;
              return (
                <article key={key} style={{ border: '1px solid var(--border, #d1d5db)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{label}</strong>
                    <strong style={{ textTransform: 'capitalize' }}>
                      <span className={`badge ${status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </strong>
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: 8, margin: '12px 0' }}>
                    <dt>Uploaded by</dt><dd style={{ margin: 0 }}>{document.uploadedBy || '—'}</dd>
                    <dt>Submitted</dt><dd style={{ margin: 0 }}>{document.submittedAt ? new Date(document.submittedAt).toLocaleString() : '—'}</dd>
                    {document.reviewedAt ? <><dt>Reviewed</dt><dd style={{ margin: 0 }}>{new Date(document.reviewedAt).toLocaleString()}</dd></> : null}
                    {document.rejectionReason ? <><dt style={{ color: '#dc2626' }}>Rejection reason</dt><dd style={{ margin: 0, color: '#dc2626' }}>{document.rejectionReason}</dd></> : null}
                  </dl>
                  {document.viewUrl ? (
                    <a href={document.viewUrl} target="_blank" rel="noreferrer">Open secure document (expires shortly)</a>
                  ) : (
                    <p>This document has no authorized private preview available.</p>
                  )}
                  {status === 'pending' && driver.canReviewDocuments && (
                    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                      <label>
                        Rejection reason
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={reasons[key] || ''}
                          onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))}
                          placeholder="Explain what is invalid or unreadable."
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn" disabled={Boolean(reviewing)} onClick={() => review(key, 'approve')}>
                          {busy ? 'Saving…' : 'Approve document'}
                        </button>
                        <button type="button" className="btn btn-secondary" disabled={Boolean(reviewing)} onClick={() => review(key, 'reject')}>
                          Reject &amp; request re-upload
                        </button>
                      </div>
                    </div>
                  )}
                  {status === 'pending' && !driver.canReviewDocuments && (
                    <p>Only the designated Super Admin can approve or reject this document.</p>
                  )}
                </article>
              );
            })}
          </div>

          {/* 3. Final Driver Approval Actions */}
          <div style={{ marginTop: 28, padding: 18, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>Final Driver Approval</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
              Final approval activates the driver on the platform. Mandatory conditions: both KYC documents approved, and for agency drivers, agency association accepted.
            </p>

            {driver.canReviewDocuments ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <label>
                  Rejection or suspension reason
                  <input
                    type="text"
                    value={driverActionReason}
                    onChange={(e) => setDriverActionReason(e.target.value)}
                    placeholder="Provide reason if rejecting or suspending..."
                    style={{ width: '100%', padding: 8, fontSize: 13, marginTop: 4 }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={acting || !canApprove}
                    onClick={() => handleDriverApproval('approve')}
                  >
                    {acting ? 'Processing...' : 'Approve Driver (Final)'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={acting || driver.approvalStatus === 'rejected'}
                    onClick={() => handleDriverApproval('reject')}
                  >
                    Reject Driver
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={acting || driver.approvalStatus === 'suspended'}
                    onClick={() => handleDriverApproval('suspend')}
                  >
                    Suspend Driver
                  </button>
                </div>
                {!docsApproved && (
                  <p style={{ fontSize: 12, color: '#f59e0b', margin: 0 }}>
                    * Driver cannot be approved until both Identity Proof and Driving Licence documents are approved.
                  </p>
                )}
                {hasAgency && !agencyAccepted && (
                  <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>
                    * Driver cannot be approved until the related agency admin accepts the driver joining request.
                  </p>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Only the designated Super Admin has permission to finalize driver approval.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
