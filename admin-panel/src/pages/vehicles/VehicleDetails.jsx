import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import vehicleService from '../../services/vehicleService';
import './vehicles.css';
import './vehicleDetails.css';

const types = ['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'];
const bodies = ['open', 'closed', 'container', 'flatbed'];
const photoList = (vehicle) => {
  const photos = Array.isArray(vehicle?.vehicleImages)
    ? vehicle.vehicleImages.filter((photo) => typeof photo === 'string' && photo)
    : [];
  return (photos.length ? photos : (vehicle?.vehicleImage ? [vehicle.vehicleImage] : [])).slice(0, 4);
};
const formatDate = (date) => date ? new Date(date).toLocaleString() : '—';
const statusLabel = (status) => ({
  not_uploaded: 'Missing',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
}[status || 'not_uploaded'] || status);

function StatusBadge({ status }) {
  return <span className={`vehicle-status vehicle-status-${status || 'not_uploaded'}`}>{statusLabel(status)}</span>;
}

function Info({ label, value }) {
  return <div className="vehicle-info-item"><span>{label}</span><strong>{value ?? '—'}</strong></div>;
}

function VehicleDocumentCard({ vehicle, docType, label, onPreview, onReview, canReview, canView, busy, reason, onReasonChange }) {
  const document = vehicle?.documents?.[docType] || { status: 'not_uploaded' };
  const status = document.status || 'not_uploaded';
  const isBusy = Boolean(busy?.startsWith(`${docType}-`));
  return (
    <article className="vehicle-document-card">
      <header className="vehicle-document-heading">
        <div>
          <h3>{label}</h3>
          <p>Separate review status; this decision will not affect the other document.</p>
        </div>
        <StatusBadge status={status} />
      </header>
      <div className="vehicle-info-grid vehicle-document-info">
        <Info label="Document file" value={status === 'not_uploaded' ? '—' : `${label}${document.format ? ` (${document.format.toUpperCase()})` : ''}`} />
        <Info label="Submitted" value={formatDate(document.submittedAt)} />
        <Info label="Uploaded by" value={document.uploadedBy} />
        <Info label="Last reviewed" value={formatDate(document.reviewedAt)} />
        <Info label="Reviewed by" value={document.reviewedBy} />
      </div>
      {document.rejectionReason ? <p className="vehicle-rejection-note"><strong>Rejection reason:</strong> {document.rejectionReason}</p> : null}
      <div className="vehicle-document-actions">
        {status !== 'not_uploaded' && canView ? (
          <button type="button" className="vehicle-primary-button" onClick={() => onPreview(docType, label)} disabled={isBusy}>
            View {docType === 'registration' ? 'RC' : 'Insurance'}
          </button>
        ) : status === 'not_uploaded' ? <span className="vehicle-muted">No document submitted</span> : <span className="vehicle-muted">Only the designated Super Admin can view this private document.</span>}
      </div>
      {canReview && status === 'pending' ? (
        <div className="vehicle-review-box">
          <label>Rejection reason required to reject
            <textarea
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Explain what is missing, invalid, or unreadable."
            />
          </label>
          <div className="vehicle-review-buttons">
            <button type="button" className="vehicle-primary-button" onClick={() => onReview(docType, 'approve')} disabled={isBusy}>
              {busy === `${docType}-approve` ? 'Approving…' : 'Approve'}
            </button>
            <button type="button" className="vehicle-secondary-button vehicle-reject-button" onClick={() => onReview(docType, 'reject')} disabled={isBusy}>
              {busy === `${docType}-reject` ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      ) : null}
      {!canReview && status === 'pending' ? (
        <p className="vehicle-muted">Only the designated Super Admin can approve or reject vehicle documents.</p>
      ) : null}
      {Array.isArray(document.reviewHistory) && document.reviewHistory.length > 0 ? (
        <details className="vehicle-audit-history">
          <summary>Review history ({document.reviewHistory.length})</summary>
          <ol>
            {document.reviewHistory.slice().reverse().map((entry, index) => (
              <li key={`${entry.reviewedAt || index}-${index}`}>
                <strong>{statusLabel(entry.previousStatus)} → {statusLabel(entry.newStatus)}</strong>
                <span>{formatDate(entry.reviewedAt)} · {entry.reviewedBy?.name || entry.reviewedBy || 'Super Admin'}</span>
                {entry.rejectionReason ? <span>Reason: {entry.rejectionReason}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  );
}

export default function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewReasons, setReviewReasons] = useState({ registration: '', insurance: '' });
  const [reviewing, setReviewing] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [galleryError, setGalleryError] = useState(false);
  const [heroPhotoError, setHeroPhotoError] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const photos = useMemo(() => photoList(vehicle), [vehicle]);

  const loadVehicle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vehicleService.getVehicle(id);
      const record = response.data?.data?.vehicle;
      if (!record) throw new Error('Vehicle details were not returned by the API.');
      setVehicle(record);
      setHeroPhotoError(false);
      setForm({
        vehicleNumber: record.vehicleNumber || '',
        vehicleModel: record.vehicleModel || '',
        vehicleType: record.vehicleType || types[0],
        capacityValue: String(record.loadCapacity?.value ?? ''),
        capacityUnit: record.loadCapacity?.unit || 'kg',
        bodyType: record.bodyType || 'open'
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load vehicle details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  const updateForm = (name, value) => setForm((current) => ({ ...current, [name]: value }));

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
      await vehicleService.updateVehicle(id, {
        vehicleNumber: form.vehicleNumber,
        vehicleModel: form.vehicleModel,
        vehicleType: form.vehicleType,
        loadCapacity: { value: capacity, unit: form.capacityUnit },
        bodyType: form.bodyType
      });
      await loadVehicle();
      setNotice('Vehicle details updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update vehicle details.');
    } finally {
      setSaving(false);
    }
  };

  const reviewDocument = async (docType, action) => {
    if (reviewing) return;
    const reason = reviewReasons[docType].trim();
    if (action === 'reject' && !reason) {
      setError('Enter a rejection reason before rejecting this document.');
      return;
    }
    if (action === 'approve' && !window.confirm(`Approve this ${docType === 'registration' ? 'RC' : 'insurance'} document?`)) return;
    if (action === 'reject' && !window.confirm(`Reject this document and request a replacement?`)) return;
    setReviewing(`${docType}-${action}`);
    setError('');
    setNotice('');
    try {
      await vehicleService.reviewDocument(id, docType, action, reason);
      await loadVehicle();
      setNotice(`Vehicle ${docType} document ${action === 'approve' ? 'approved' : 'rejected'}.`);
      setReviewReasons((current) => ({ ...current, [docType]: '' }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to update vehicle document verification.');
    } finally {
      setReviewing('');
    }
  };

  const openPreview = async (docType, label) => {
    setPreview({ docType, label, format: vehicle?.documents?.[docType]?.format || '' });
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const response = await vehicleService.getDocumentView(id, docType);
      const document = response.data?.data?.document;
      if (!document?.viewUrl) throw new Error('A secure preview link was not returned.');
      setPreview((current) => ({ ...current, ...document }));
    } catch (requestError) {
      setPreviewError(requestError.response?.data?.message || requestError.message || 'Unable to load this secure document.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const retryPreview = () => {
    if (preview) openPreview(preview.docType, preview.label);
  };

  const closePreview = () => {
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(false);
  };

  const toggleVehicleStatus = async () => {
    const nextActive = !vehicle.isActive;
    if (!window.confirm(`Are you sure you want to ${nextActive ? 'activate' : 'deactivate'} ${vehicle.vehicleNumber}?`)) return;
    setStatusUpdating(true);
    setError('');
    setNotice('');
    try {
      const response = await vehicleService.updateVehicleStatus(id, nextActive);
      if (response.data?.data?.vehicle) setVehicle((current) => ({ ...current, ...response.data.data.vehicle }));
      await loadVehicle();
      setNotice(`Vehicle ${nextActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to change vehicle status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const galleryPrevious = () => {
    setGalleryError(false);
    setGalleryIndex((current) => (current - 1 + photos.length) % photos.length);
  };
  const galleryNext = () => {
    setGalleryError(false);
    setGalleryIndex((current) => (current + 1) % photos.length);
  };

  return (
    <section className="vehicle-page">
      <header className="vehicle-page-header">
        <div>
          <button type="button" className="vehicle-back-button" onClick={() => navigate('/vehicles')}><ArrowLeft size={16} /> Vehicles</button>
          <h1>Vehicle details</h1>
          <p>Inspect the vehicle, its agency and driver relationship, and review RC and Insurance independently.</p>
        </div>
        <button type="button" className="vehicle-secondary-button" onClick={loadVehicle} disabled={loading}>Refresh</button>
      </header>
      {error ? <div className="vehicle-error" role="alert"><span>{error}</span><button type="button" onClick={loadVehicle}>Retry</button></div> : null}
      {notice ? <p className="vehicle-notice" role="status">{notice}</p> : null}
      {loading ? <section className="vehicle-panel">Loading vehicle details…</section> : vehicle ? (
        <>
          <section className="vehicle-detail-hero">
            <div className="vehicle-hero-image">
              {photos[0] && !heroPhotoError ? (
                <img src={photos[0]} alt={`${vehicle.vehicleNumber} primary view`} onError={() => setHeroPhotoError(true)} />
              ) : <><CarFront size={42} /><span>{photos.length ? 'Photo preview unavailable' : 'No vehicle photos'}</span></>}
            </div>
            <div className="vehicle-hero-content">
              <div className="vehicle-hero-title">
                <div><span className="vehicle-detail-eyebrow">REGISTRATION</span><h2>{vehicle.vehicleNumber}</h2><p>{vehicle.vehicleModel} · {vehicle.vehicleType?.replace('-', ' ')}</p></div>
                <span className={`vehicle-status vehicle-status-${vehicle.isActive ? 'active' : 'inactive'}`}>{vehicle.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="vehicle-hero-meta">
                <span>{vehicle.isAvailable ? 'Available' : 'Unavailable'}</span>
                <span>{vehicle.driver ? `Assigned: ${vehicle.driver.fullName || 'Driver'}` : 'Unassigned'}</span>
                <span>{vehicle.agency?.agencyName || 'Independent vehicle'}</span>
              </div>
              <div className="vehicle-hero-actions">
                {photos.length ? <button type="button" className="vehicle-secondary-button" onClick={() => { setGalleryIndex(0); setGalleryError(false); }}>View photo gallery ({photos.length})</button> : null}
                <button type="button" className="vehicle-secondary-button" disabled={statusUpdating} onClick={toggleVehicleStatus}>
                  {statusUpdating ? 'Updating…' : vehicle.isActive ? 'Deactivate vehicle' : 'Activate vehicle'}
                </button>
              </div>
            </div>
          </section>

          <div className="vehicle-details-grid">
            <section className="vehicle-panel">
              <div className="vehicle-panel-heading"><div><h2>Vehicle information</h2><p>Registration and fleet details</p></div></div>
              <div className="vehicle-info-grid">
                <Info label="Registration number" value={vehicle.vehicleNumber} />
                <Info label="Model" value={vehicle.vehicleModel} />
                <Info label="Category" value={vehicle.vehicleType?.replace('-', ' ')} />
                <Info label="Load capacity" value={`${vehicle.loadCapacity?.value ?? '—'} ${vehicle.loadCapacity?.unit || ''}`} />
                <Info label="Body type" value={vehicle.bodyType} />
                <Info label="Availability" value={vehicle.isAvailable ? 'Available' : 'Unavailable'} />
                <Info label="Created" value={formatDate(vehicle.createdAt)} />
                <Info label="Last updated" value={formatDate(vehicle.updatedAt)} />
              </div>
              <details className="vehicle-edit-details">
                <summary>Edit vehicle information</summary>
                <form onSubmit={save} className="vehicle-edit-form">
                  <label>Registration<input required value={form?.vehicleNumber || ''} onChange={(event) => updateForm('vehicleNumber', event.target.value)} /></label>
                  <label>Model<input required value={form?.vehicleModel || ''} onChange={(event) => updateForm('vehicleModel', event.target.value)} /></label>
                  <label>Category<select value={form?.vehicleType || types[0]} onChange={(event) => updateForm('vehicleType', event.target.value)}>{types.map((type) => <option key={type} value={type}>{type.replace('-', ' ')}</option>)}</select></label>
                  <label>Capacity<input required type="number" min="0" step="any" value={form?.capacityValue ?? ''} onChange={(event) => updateForm('capacityValue', event.target.value)} /></label>
                  <label>Capacity unit<select value={form?.capacityUnit || 'kg'} onChange={(event) => updateForm('capacityUnit', event.target.value)}><option value="kg">KG</option><option value="ton">TON</option></select></label>
                  <label>Body type<select value={form?.bodyType || 'open'} onChange={(event) => updateForm('bodyType', event.target.value)}>{bodies.map((body) => <option key={body}>{body}</option>)}</select></label>
                  <button type="submit" className="vehicle-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save vehicle details'}</button>
                </form>
              </details>
            </section>

            <section className="vehicle-panel">
              <div className="vehicle-panel-heading"><div><h2>Agency information</h2><p>Registered fleet owner</p></div></div>
              {vehicle.agency ? (
                <div className="vehicle-info-grid">
                  <Info label="Agency" value={vehicle.agency.agencyName} />
                  <Info label="Agency ID" value={vehicle.agency._id} />
                  <Info label="Owner" value={vehicle.agency.owner?.name} />
                  <Info label="Owner contact" value={vehicle.agency.owner?.phone || vehicle.agency.phone} />
                  <Info label="Agency contact" value={vehicle.agency.phone} />
                  <Info label="Approval status" value={vehicle.agency.approvalStatus} />
                  <Info label="Agency active" value={vehicle.agency.isActive ? 'Yes' : 'No'} />
                  <Info label="Owner account role" value={vehicle.agency.owner?.role} />
                </div>
              ) : <p className="vehicle-muted">This vehicle has no associated Agency.</p>}
            </section>

            <section className="vehicle-panel">
              <div className="vehicle-panel-heading"><div><h2>Assigned driver</h2><p>Information from the actual Vehicle.driver profile relation</p></div></div>
              {vehicle.driver ? (
                <div className="vehicle-info-grid">
                  <Info label="Driver name" value={vehicle.driver.fullName} />
                  <Info label="Phone" value={vehicle.driver.phone} />
                  <Info label="Driver profile ID" value={vehicle.driver._id} />
                  <Info label="Driver KYC approval" value={vehicle.driver.approvalStatus} />
                  <Info label="Agency association" value={vehicle.driver.agencyAssociation?.status} />
                  <Info label="Driver active" value={vehicle.driver.isActive === false ? 'No' : 'Yes'} />
                  <Info label="Aadhaar / ID" value={statusLabel(vehicle.driver.documents?.idProof?.status)} />
                  <Info label="Driving licence" value={statusLabel(vehicle.driver.documents?.drivingLicense?.status)} />
                </div>
              ) : <p className="vehicle-muted">No Driver profile is assigned to this vehicle.</p>}
            </section>

            <section className="vehicle-panel vehicle-assignment-panel">
              <div className="vehicle-panel-heading"><div><h2>Assignment information</h2><p>Current assignment state; assignment permissions remain with the managing Agency</p></div></div>
              <div className="vehicle-info-grid">
                <Info label="Assignment" value={vehicle.driver ? 'Assigned' : 'Unassigned'} />
                <Info label="Assigned driver" value={vehicle.driver?.fullName} />
                <Info label="Associated agency" value={vehicle.agency?.agencyName || 'Independent'} />
                <Info label="Vehicle availability" value={vehicle.isAvailable ? 'Available' : 'Unavailable'} />
              </div>
              <p className="vehicle-muted">Super Admin can inspect assignment information but cannot replace Agency assignment authority here.</p>
            </section>
          </div>

          <section className="vehicle-panel">
            <div className="vehicle-panel-heading"><div><h2>RC &amp; Insurance verification</h2><p>Each private document is reviewed independently. Approval of one does not approve the other.</p></div></div>
            <div className="vehicle-document-grid">
              <VehicleDocumentCard
                vehicle={vehicle} docType="registration" label="Registration Certificate (RC)"
                onPreview={openPreview} onReview={reviewDocument} canReview={vehicle.canReviewDocuments}
                canView={vehicle.canViewDocuments}
                busy={reviewing} reason={reviewReasons.registration}
                onReasonChange={(value) => setReviewReasons((current) => ({ ...current, registration: value }))}
              />
              <VehicleDocumentCard
                vehicle={vehicle} docType="insurance" label="Vehicle Insurance"
                onPreview={openPreview} onReview={reviewDocument} canReview={vehicle.canReviewDocuments}
                canView={vehicle.canViewDocuments}
                busy={reviewing} reason={reviewReasons.insurance}
                onReasonChange={(value) => setReviewReasons((current) => ({ ...current, insurance: value }))}
              />
            </div>
          </section>
        </>
      ) : null}

      {preview ? (
        <div className="vehicle-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
          <section className="vehicle-preview-modal" role="dialog" aria-modal="true" aria-label={`${preview.label} preview`}>
            <header><div><h2>{preview.label}</h2><p>{vehicle?.vehicleNumber} · Secure temporary preview</p></div><button type="button" aria-label="Close preview" onClick={closePreview}><X /></button></header>
            {previewLoading ? <div className="vehicle-preview-state">Loading secure document…</div> : null}
            {!previewLoading && previewError ? <div className="vehicle-preview-state vehicle-preview-error"><p>{previewError}</p><button type="button" className="vehicle-primary-button" onClick={retryPreview}>Retry secure fetch</button></div> : null}
            {!previewLoading && !previewError && preview.viewUrl ? (
              <div className="vehicle-preview-content">
                {String(preview.format || '').toLowerCase() === 'pdf' ? (
                  <iframe title={`${preview.label} PDF`} src={preview.viewUrl} referrerPolicy="no-referrer" onError={() => setPreviewError('The secure PDF preview could not be loaded. Fetch a fresh link and retry.')} />
                ) : (
                  <img src={preview.viewUrl} alt={preview.label} referrerPolicy="no-referrer" onError={() => setPreviewError('The secure preview could not be loaded. Fetch a fresh link and retry.')} />
                )}
                <div className="vehicle-preview-footer">
                  <span>{statusLabel(vehicle?.documents?.[preview.docType]?.status)} · Expires shortly</span>
                  <button type="button" className="vehicle-secondary-button" onClick={retryPreview}>Refresh preview</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {galleryIndex !== null && photos.length ? (
        <div className="vehicle-modal-backdrop vehicle-gallery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGalleryIndex(null); }}>
          <section className="vehicle-gallery-modal" role="dialog" aria-modal="true" aria-label="Vehicle photo gallery">
            <header><div><h2>{vehicle.vehicleNumber} · Vehicle photos</h2><p>{galleryIndex + 1} of {photos.length}</p></div><button type="button" aria-label="Close gallery" onClick={() => setGalleryIndex(null)}><X /></button></header>
            <div className="vehicle-gallery-main">
              {galleryError ? <div className="vehicle-preview-state">This image could not be displayed.</div> : <img src={photos[galleryIndex]} alt={`Vehicle photo ${galleryIndex + 1}`} onError={() => setGalleryError(true)} />}
              {photos.length > 1 ? <>
                <button type="button" aria-label="Previous photo" onClick={galleryPrevious}><ChevronLeft /></button>
                <button type="button" aria-label="Next photo" onClick={galleryNext}><ChevronRight /></button>
              </> : null}
            </div>
            <div className="vehicle-gallery-thumbnails">
              {photos.map((photo, index) => <button type="button" key={`${photo}-${index}`} className={index === galleryIndex ? 'selected' : ''} onClick={() => { setGalleryError(false); setGalleryIndex(index); }}><img src={photo} alt={`Select photo ${index + 1}`} /></button>)}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
