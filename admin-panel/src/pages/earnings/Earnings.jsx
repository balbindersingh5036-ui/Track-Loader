import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

export default function Earnings() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (requestedPage = page) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/driver-earnings', { params: { page: requestedPage, limit: 20 } });
      const result = response.data?.data;
      if (!Array.isArray(result?.earnings)) throw new Error('Unexpected response from the earnings endpoint.');
      setData(result);
      setPage(result.pagination?.page || requestedPage);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load driver earnings.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(1); }, []);

  const totalPages = data?.pagination?.totalPages || 1;
  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h2 className="card-title">Driver earnings</h2>
        <button type="button" className="btn" onClick={() => load(page)} disabled={loading}>Refresh</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? <p role="status">Loading driver earnings…</p> : data && (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
            <p>Completed trips: <strong>{data.completedTrips ?? 0}</strong></p>
            <p>Total earnings: <strong>₹{data.totalEarnings ?? 0}</strong></p>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Booking</th><th>Driver</th><th>Completed</th><th>Fare</th><th>Payment status</th></tr></thead>
              <tbody>
                {data.earnings.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>No completed trips</td></tr>
                ) : data.earnings.map((earning) => (
                  <tr key={earning._id}>
                    <td>{earning.bookingId}</td>
                    <td>{earning.driver?.fullName || earning.driver?.user?.name || '—'}</td>
                    <td>{earning.completedAt ? new Date(earning.completedAt).toLocaleDateString() : '—'}</td>
                    <td>₹{earning.finalFare ?? earning.estimatedFare ?? 0}</td>
                    <td>{earning.paymentStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
              <button type="button" className="btn" onClick={() => load(page - 1)} disabled={page <= 1 || loading}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" className="btn" onClick={() => load(page + 1)} disabled={page >= totalPages || loading}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
