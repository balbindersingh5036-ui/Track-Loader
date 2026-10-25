import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const types = ['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'];
const bodies = ['open', 'closed', 'container', 'flatbed'];

export default function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewReasons, setReviewReasons] = useState({});
  const [reviewing, setReviewing] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/admin/vehicles/${encodeURIComponent(id)}`)
      .then((response) => {
        const record = response.data?.data?.vehicle;
        if (!record) throw new Error('Vehicle details were not returned by the API.');
        if (active) {
          setVehicle(record);
          setForm({
            vehicleNumber: record.vehicleNumber || '',
            vehicleModel: record.vehicleModel || '',
            vehicleType: record.vehicleType,
            capacityValue: String(record.loadCapacity?.value ?? ''),
            capacityUnit: record.loadCapacity?.unit || 'kg',
            bodyType: record.bodyType || 'open'
          });
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Unable to load vehicle details.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault();
    const capacity = Number(form.capacityValue);
    if (!form.vehicleNumber.trim() || !form.vehicleModel.trim() || !Number.isFinite(capacity) || capacity < 0) {
      setError('Enter a registration, model, and non-negative capacity.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await api.put(`/admin/vehicles/${encodeURIComponent(id)}`, {
        vehicleNumber: form.vehicleNumber,
        vehicleModel: form.vehicleModel,
        vehicleType: form.vehicleType,
        loadCapacity: { value: capacity, unit: form.capacityUnit },
        bodyType: form.bodyType
      });
      setVehicle(response.data?.data?.vehicle || vehicle);
      setNotice('Vehicle details updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update vehicle details.');
    } finally {
      setSaving(false);
    }
  };

  const reviewDocument = async (docType, action) => {
    if (reviewing) return;
    const reason = (reviewReasons[docType] || '').trim();
    if (action === 'reject' && !reason) {
      setError('Enter a reason before rejecting this document.');
      return;
    }
    setReviewing(docType);
    setError('');
    setNotice('');
    try {
      await api.patch(
        `/admin/vehicles/${encodeURIComponent(id)}/documents/${docType}/${action}`,
        action === 'reject' ? { reason } : {}
      );
      const response = await api.get(`/admin/vehicles/${encodeURIComponent(id)}`);
      setVehicle(response.data?.data?.vehicle || vehicle);
      setNotice(`Vehicle ${docType} document ${action === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update vehicle document verification.');
    } finally {
      setReviewing('');
    }
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>
        <h2 className="card-title">Vehicle details</h2>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p role="status">Loading vehicle details…</p> : form && (
        <>
          <p>Driver: {vehicle?.driver?.name || vehicle?.driver?.fullName || '—'}</p>
          <p>Active: {vehicle?.isActive ? 'Yes' : 'No'} · Available: {vehicle?.isAvailable ? 'Yes' : 'No'}</p>
          <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
            <label>Registration<input required value={form.vehicleNumber} onChange={(event) => update('vehicleNumber', event.target.value)} /></label>
            <label>Model<input required value={form.vehicleModel} onChange={(event) => update('vehicleModel', event.target.value)} /></label>
            <label>Vehicle type<select value={form.vehicleType} onChange={(event) => update('vehicleType', event.target.value)}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Capacity<input required type="number" min="0" step="any" value={form.capacityValue} onChange={(event) => update('capacityValue', event.target.value)} /></label>
            <label>Capacity unit<select value={form.capacityUnit} onChange={(event) => update('capacityUnit', event.target.value)}><option value="kg">kg</option><option value="ton">ton</option></select></label>
            <label>Body type<select value={form.bodyType} onChange={(event) => update('bodyType', event.target.value)}>{bodies.map((body) => <option key={body}>{body}</option>)}</select></label>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save vehicle details'}</button>
          </form>
          <h3 style={{ marginTop: 28 }}>Vehicle documents</h3>
          <p>Vehicle registration and insurance must both be approved before a driver can be assigned to this vehicle.</p>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { key: 'registration', label: 'Vehicle Registration Certificate (RC)' },
              { key: 'insurance', label: 'Insurance Policy' }
            ].map(({ key, label }) => {
              const document = vehicle?.documents?.[key] || { status: 'not_uploaded' };
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
                  {status === 'pending' && (
                    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                      <label>
                        Rejection reason
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={reviewReasons[key] || ''}
                          onChange={(event) => setReviewReasons((current) => ({ ...current, [key]: event.target.value }))}
                          placeholder="Explain what is invalid or unreadable."
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn" disabled={Boolean(reviewing)} onClick={() => reviewDocument(key, 'approve')}>
                          {busy ? 'Saving…' : 'Approve document'}
                        </button>
                        <button type="button" className="btn btn-secondary" disabled={Boolean(reviewing)} onClick={() => reviewDocument(key, 'reject')}>
                          Reject &amp; request re-upload
                        </button>
                      </div>
                    </div>
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
