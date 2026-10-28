import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import agencyService from '../../services/agencyService';

export default function AgencyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModal, setActionModal] = useState({ open: false, type: '', reason: '' });
  const [driverModal, setDriverModal] = useState({ open: false, driverId: null, type: '', reason: '' });
  const [documentModal, setDocumentModal] = useState({ open: false, docType: '', action: '', reason: '' });

  const loadAgency = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await agencyService.getAdminAgencyById(id);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load agency details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgency();
  }, [id]);

  const handleApproveAgency = async () => {
    try {
      setActionLoading(true);
      await agencyService.approveAgency(id);
      await loadAgency();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgencyActionWithReason = async () => {
    try {
      setActionLoading(true);
      if (actionModal.type === 'reject') {
        await agencyService.rejectAgency(id, actionModal.reason);
      } else if (actionModal.type === 'suspend') {
        await agencyService.suspendAgency(id, actionModal.reason);
      }
      setActionModal({ open: false, type: '', reason: '' });
      await loadAgency();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAgencyDocumentReview = async () => {
    try {
      setActionLoading(true);
      await agencyService.reviewAgencyDocument(
        id,
        documentModal.docType,
        documentModal.action,
        documentModal.reason
      );
      setDocumentModal({ open: false, docType: '', action: '', reason: '' });
      await loadAgency();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Document review failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDriver = async (driverId) => {
    try {
      setActionLoading(true);
      await agencyService.approveDriver(driverId);
      await loadAgency();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Driver approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDriverActionWithReason = async () => {
    try {
      setActionLoading(true);
      if (driverModal.type === 'reject') {
        await agencyService.rejectDriver(driverModal.driverId, driverModal.reason);
      } else if (driverModal.type === 'suspend') {
        await agencyService.suspendDriver(driverModal.driverId, driverModal.reason);
      }
      setDriverModal({ open: false, driverId: null, type: '', reason: '' });
      await loadAgency();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Driver action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <section className="card"><p role="status">Loading agency details...</p></section>;
  }

  if (error || !data?.agency) {
    return (
      <section className="card">
        <p role="alert" style={{ color: 'var(--danger)' }}>{error || 'Agency record not found'}</p>
        <button type="button" className="btn" onClick={() => navigate('/agencies')}>Back to Agencies</button>
      </section>
    );
  }

  const { agency, drivers, vehicles } = data;
  const docs = agency.documents || {};
  const agencyDocuments = [
    { type: 'ownerAadhaar', label: 'Owner Aadhaar Document', optional: false },
    { type: 'businessRegistration', label: 'Business Registration / Trade Licence', optional: true },
    { type: 'taxId', label: 'Tax ID / GST Document', optional: true }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="btn" onClick={() => navigate('/agencies')}>Back</button>
            <h2 className="card-title" style={{ margin: 0 }}>{agency.agencyName}</h2>
            <span style={{
              background: agency.approvalStatus === 'approved' ? '#dcfce7' : agency.approvalStatus === 'rejected' ? '#fee2e2' : '#fef9c3',
              color: agency.approvalStatus === 'approved' ? '#166534' : agency.approvalStatus === 'rejected' ? '#991b1b' : '#854d0e',
              padding: '4px 10px', borderRadius: 12, fontWeight: 'bold', fontSize: 13, textTransform: 'capitalize'
            }}>
              {agency.approvalStatus}
            </span>
          </div>

          {data.canReviewAgencyDocuments && <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionLoading || agency.approvalStatus === 'approved'}
              onClick={handleApproveAgency}
            >
              Approve Agency
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: '#fee2e2', color: '#991b1b' }}
              disabled={actionLoading || agency.approvalStatus === 'rejected'}
              onClick={() => setActionModal({ open: true, type: 'reject', reason: '' })}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn"
              disabled={actionLoading || agency.approvalStatus === 'suspended'}
              onClick={() => setActionModal({ open: true, type: 'suspend', reason: '' })}
            >
              Suspend
            </button>
          </div>}
        </div>

        {agency.rejectionReason && (
          <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 14 }}>
            <strong>Reason for rejection/suspension:</strong> {agency.rejectionReason}
          </div>
        )}
      </section>

      {!data.superAdminReviewConfigured ? (
        <section className="card" role="alert" style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
          Super Admin review actions are unavailable until the backend is configured with the designated `SUPER_ADMIN_USER_ID`.
        </section>
      ) : !data.canReviewAgencyDocuments ? (
        <section className="card" role="status" style={{ background: '#f8fafc', color: '#475569' }}>
          You can view agency status, but only the designated Super Admin can approve agencies or review KYC documents.
        </section>
      ) : null}

      {/* Profile & Owner Document Verification */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        <section className="card">
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>Agency & Owner Profile</h3>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, margin: 0 }}>
            <dt style={{ fontWeight: 600 }}>Phone:</dt>
            <dd style={{ margin: 0 }}>{agency.phone || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Email:</dt>
            <dd style={{ margin: 0 }}>{agency.email || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Address:</dt>
            <dd style={{ margin: 0 }}>{agency.address || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>City:</dt>
            <dd style={{ margin: 0 }}>{agency.city || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Owner Name:</dt>
            <dd style={{ margin: 0 }}>{agency.owner?.name || '—'}</dd>
            <dt style={{ fontWeight: 600 }}>Owner Phone:</dt>
            <dd style={{ margin: 0 }}>{agency.owner?.phone || '—'}</dd>
          </dl>
        </section>

        <section className="card">
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>Verification Documents (KYC)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {agencyDocuments.map(({ type, label, optional }) => {
              const document = docs[type] || {};
              const submitted = document.status && document.status !== 'not_uploaded';
              return (
                <div key={type} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}{optional ? ' (Optional)' : ''}</div>
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    Status: <strong>{submitted ? document.status : optional ? 'optional / not uploaded' : 'missing'}</strong>
                    {document.submittedAt ? ` · Submitted ${new Date(document.submittedAt).toLocaleString()}` : ''}
                    {document.reviewedAt ? ` · Reviewed ${new Date(document.reviewedAt).toLocaleString()}` : ''}
                  </div>
                  {document.rejectionReason ? <div role="alert" style={{ color: '#991b1b', fontSize: 12, marginBottom: 8 }}>Rejection reason: {document.rejectionReason}</div> : null}
                  {document.viewUrl ? (
                    <a href={document.viewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      View securely (temporary link)
                    </a>
                  ) : submitted ? (
                    <div style={{ color: '#92400e', fontSize: 12, marginBottom: 8 }}>
                      This legacy document is not in the private review vault. Ask the owner to resubmit it securely before review.
                    </div>
                  ) : null}
                  {data.canReviewAgencyDocuments && document.viewUrl ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => setDocumentModal({ open: true, docType: type, action: 'approve', reason: '' })}
                      >
                        Approve document
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={actionLoading}
                        onClick={() => setDocumentModal({ open: true, docType: type, action: 'reject', reason: '' })}
                        style={{ background: '#fee2e2', color: '#991b1b' }}
                      >
                        Reject with reason
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {agency.approvalStatus === 'approved' && docs.ownerAadhaar?.status !== 'approved' ? (
        <section className="card" role="status" style={{ borderColor: '#fcd34d', background: '#fffbeb', color: '#92400e' }}>
          <strong>Owner identity document is not verified.</strong> Current backend business rules do not require Owner Aadhaar approval for agency approval or driver-registration dropdown eligibility. The agency remains active under the existing approved/active rule; request secure resubmission and review if policy requires it. No status was changed automatically.
        </section>
      ) : null}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Agency Review History</h3>
        {(agency.reviewHistory || []).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
            No detailed review history was recorded for earlier actions. The current approval timestamp and reviewer are {agency.approvedAt ? 'available in the agency profile' : 'not recorded'}.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {agency.reviewHistory.slice().reverse().map((entry, index) => (
              <li key={`${entry.reviewedAt}-${index}`} style={{ marginBottom: 6 }}>
                {entry.action.replaceAll('_', ' ')}{entry.documentType ? ` · ${entry.documentType}` : ''}
                {entry.reason ? ` — ${entry.reason}` : ''}
                {' · '}{entry.reviewedBy?.name || 'Super Admin'} · {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleString() : 'time unavailable'}
              </li>
            ))}
          </ul>
        )}
        {agency.approvedAt ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            Current approval: {new Date(agency.approvedAt).toLocaleString()} by {agency.approvedBy?.name || 'recorded administrator'}.
          </div>
        ) : null}
      </section>

      {/* Agency Managed Drivers */}
      <section className="card">
        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          Agency Drivers ({drivers?.length || 0})
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: -4, marginBottom: 16 }}>
          Super Admin verification authority: Agency owners register drivers and upload their documents. Only Super Admin can approve, reject or suspend drivers.
        </p>

        {(!drivers || drivers.length === 0) ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No drivers registered under this agency yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Aadhaar</th>
                  <th>Driving Licence</th>
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
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize'
                      }}>
                        {d.approvalStatus}
                      </span>
                    </td>
                    <td>
                      {d.documents?.idProof?.viewUrl ? (
                        <a href={d.documents.idProof.viewUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          View Aadhaar
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Not provided</span>
                      )}
                    </td>
                    <td>
                      {d.documents?.drivingLicense?.viewUrl ? (
                        <a href={d.documents.drivingLicense.viewUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          View Licence
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Not provided</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {d.canReviewDocuments ? <>
                        <button
                          type="button"
                          className="btn"
                          disabled={actionLoading || d.approvalStatus === 'approved'}
                          onClick={() => handleApproveDriver(d._id)}
                          style={{ fontSize: 12, padding: '4px 8px', background: '#dcfce7', color: '#166534' }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={actionLoading || d.approvalStatus === 'rejected'}
                          onClick={() => setDriverModal({ open: true, driverId: d._id, type: 'reject', reason: '' })}
                          style={{ fontSize: 12, padding: '4px 8px', background: '#fee2e2', color: '#991b1b' }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={actionLoading || d.approvalStatus === 'suspended'}
                          onClick={() => setDriverModal({ open: true, driverId: d._id, type: 'suspend', reason: '' })}
                          style={{ fontSize: 12, padding: '4px 8px' }}
                        >
                          Suspend
                        </button>
                        </> : <span style={{ color: 'var(--text-secondary)', fontSize: 12, alignSelf: 'center' }}>Super Admin review only</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Agency Owned Vehicles */}
      <section className="card">
        <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
          Agency Fleet Vehicles ({vehicles?.length || 0})
        </h3>
        {(!vehicles || vehicles.length === 0) ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No vehicles assigned to this agency yet.</p>
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
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v._id}>
                    <td style={{ fontWeight: 600 }}>{v.vehicleNumber}</td>
                    <td>{v.vehicleModel}</td>
                    <td style={{ textTransform: 'capitalize' }}>{v.vehicleType}</td>
                    <td>{v.loadCapacity?.value} {v.loadCapacity?.unit}</td>
                    <td>{v.driver?.fullName ? `${v.driver.fullName} (${v.driver.phone})` : '—'}</td>
                    <td>
                      <span style={{
                        color: v.isAvailable ? '#166534' : '#991b1b',
                        fontWeight: 600, fontSize: 12
                      }}>
                        {v.isAvailable ? 'Available' : 'Busy / On Trip'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Agency Action Modal */}
      {actionModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{actionModal.type} Agency</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Enter reason for {actionModal.type}ing agency:
            </p>
            <textarea
              style={{ width: '100%', height: 80, padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 16 }}
              value={actionModal.reason}
              onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
              placeholder="e.g. Unverified business credentials"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setActionModal({ open: false, type: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={handleAgencyActionWithReason}
                disabled={actionLoading || !actionModal.reason.trim()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Action Modal */}
      {driverModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{driverModal.type} Driver</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Enter reason for {driverModal.type}ing driver:
            </p>
            <textarea
              style={{ width: '100%', height: 80, padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 16 }}
              value={driverModal.reason}
              onChange={(e) => setDriverModal({ ...driverModal, reason: e.target.value })}
              placeholder="e.g. Expired driving licence or blurred document image."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setDriverModal({ open: false, driverId: null, type: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={handleDriverActionWithReason}
                disabled={actionLoading}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {documentModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="agency-document-review-title" style={{ width: '100%', maxWidth: 440 }}>
            <h3 id="agency-document-review-title">{documentModal.action === 'approve' ? 'Approve agency document' : 'Reject agency document'}</h3>
            {documentModal.action === 'reject' ? (
              <>
                <label htmlFor="agency-document-rejection-reason">Reason (required)</label>
                <textarea
                  id="agency-document-rejection-reason"
                  maxLength={500}
                  required
                  value={documentModal.reason}
                  onChange={(event) => setDocumentModal({ ...documentModal, reason: event.target.value })}
                  style={{ width: '100%', minHeight: 90, marginTop: 8 }}
                />
              </>
            ) : <p>This records the document review decision only; agency approval status is unchanged.</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setDocumentModal({ open: false, docType: '', action: '', reason: '' })}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={actionLoading || (documentModal.action === 'reject' && !documentModal.reason.trim())}
                onClick={handleAgencyDocumentReview}
                style={documentModal.action === 'reject' ? { background: '#991b1b', color: '#fff' } : undefined}
              >
                {actionLoading ? 'Saving…' : `Confirm ${documentModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
