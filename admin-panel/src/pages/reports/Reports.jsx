import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const names = ['dashboard', 'bookings', 'revenue', 'customers', 'drivers', 'vehicles', 'payments', 'ratings', 'complaints'];
      const entries = await Promise.all(names.map(async (name) => {
        const response = await api.get(`/admin/reports/${name}`);
        return [name, response.data?.data];
      }));
      setReports(Object.fromEntries(entries));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadExport = async (name) => {
    setError('');
    try {
      const response = await api.get(`/admin/reports/${name}/export`);
      const exportData = response.data?.data?.exportData;
      if (!Array.isArray(exportData)) throw new Error('The export endpoint returned an unexpected response.');
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-report.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to export the report.');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">Reports</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => downloadExport('bookings')} disabled={loading}>Export bookings</button>
          <button type="button" className="btn" onClick={() => downloadExport('payments')} disabled={loading}>Export payments</button>
          <button type="button" className="btn" onClick={load} disabled={loading}>Refresh reports</button>
        </div>
      </div>
      {loading && <p role="status">Loading reports…</p>}
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {reports && Object.entries(reports).map(([name, value]) => (
        <section key={name} style={{ marginBottom: 20 }}>
          <h3>{name[0].toUpperCase() + name.slice(1)}</h3>
          <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>
        </section>
      ))}
    </div>
  );
}