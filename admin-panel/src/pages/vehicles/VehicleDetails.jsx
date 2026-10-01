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
        </>
      )}
    </section>
  );
}
