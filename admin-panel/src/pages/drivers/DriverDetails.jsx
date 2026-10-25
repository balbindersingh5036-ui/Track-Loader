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
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');
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

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>
        <h2 className="card-title">Driver details &amp; KYC review</h2>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading driver details…</p>}
      {!loading && driver && (
        <>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 12 }}>
            <dt style={{ fontWeight: 700 }}>Name</dt><dd style={{ margin: 0 }}>{driver.name || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Phone</dt><dd style={{ margin: 0 }}>{driver.phone || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Email</dt><dd style={{ margin: 0 }}>{driver.email || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Driver approval</dt><dd style={{ margin: 0, textTransform: 'capitalize' }}>{driver.approvalStatus || 'pending'}</dd>
            <dt style={{ fontWeight: 700 }}>Account status</dt><dd style={{ margin: 0 }}>{driver.isActive ? 'Active' : 'Inactive'}</dd>
            <dt style={{ fontWeight: 700 }}>Agency</dt><dd style={{ margin: 0 }}>{driver.agency?.agencyName || 'Independent'}</dd>
            <dt style={{ fontWeight: 700 }}>Rejection reason</dt><dd style={{ margin: 0 }}>{driver.rejectionReason || '—'}</dd>
            <dt style={{ fontWeight: 700 }}>Vehicles</dt>
            <dd style={{ margin: 0 }}>{(driver.vehicles || []).map((vehicle) => `${vehicle.vehicleNumber} (${vehicle.vehicleModel})`).join(', ') || '—'}</dd>
          </dl>

          <h3 style={{ marginTop: 28 }}>Required identity documents</h3>
          <p>Driver approval is only available after both documents have been approved.</p>
          <div style={{ display: 'grid', gap: 14 }}>
            {requiredDocuments.map(({ key, label }) => {
              const document = driver.documents?.[key] || { status: 'not_uploaded' };
              const status = document.status || 'not_uploaded';
              const busy = reviewing === key;
              return (
                <article key={key} style={{ border: '1px solid var(--border, #d1d5db)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{label}</strong>
                    <strong style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}</strong>
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: 8, margin: '12px 0' }}>
                    <dt>Uploaded by</dt><dd style={{ margin: 0 }}>{document.uploadedBy || '—'}</dd>
                    <dt>Submitted</dt><dd style={{ margin: 0 }}>{document.submittedAt ? new Date(document.submittedAt).toLocaleString() : '—'}</dd>
                    {document.reviewedAt ? <><dt>Reviewed</dt><dd style={{ margin: 0 }}>{new Date(document.reviewedAt).toLocaleString()}</dd></> : null}
                    {document.rejectionReason ? <><dt>Rejection reason</dt><dd style={{ margin: 0 }}>{document.rejectionReason}</dd></> : null}
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
        </>
      )}
    </section>
  );
}
