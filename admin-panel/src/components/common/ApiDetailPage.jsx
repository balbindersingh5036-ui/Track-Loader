import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

export default function ApiDetailPage({ title, endpoint, resource, fields }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(`${endpoint}/${encodeURIComponent(id)}`)
      .then((response) => {
        const value = response.data?.data?.[resource];
        if (!value) throw new Error(`The ${title.toLowerCase()} record was not returned by the API.`);
        if (active) setRecord(value);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || `Unable to load ${title.toLowerCase()}.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [endpoint, id, resource, title]);

  const read = (path) => {
    const value = path.split('.').reduce((current, key) => current?.[key], record);
    if (value === null || value === undefined || value === '') return '—';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>
        <h2 className="card-title">{title} details</h2>
      </div>
      {loading && <p role="status">Loading details…</p>}
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && record && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 12 }}>
          {fields.map((field) => (
            <React.Fragment key={field.label}>
              <dt style={{ fontWeight: 700 }}>{field.label}</dt>
              <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{field.render ? field.render(record) : read(field.path)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
