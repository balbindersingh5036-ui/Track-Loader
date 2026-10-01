import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

export default function Notifications() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications');
      setData(response.data?.data?.notifications || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update the notification.');
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update notifications.');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">My Admin Notifications</h2>
        <button type="button" className="btn" onClick={markAllRead} disabled={loading || !data.some((item) => !item.isRead)}>Mark all read</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading && <p role="status">Loading notifications…</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {!loading && data.length === 0 ? (
          <li style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No notifications</li>
        ) : !loading && (
          data.map(n => (
            <li key={n._id} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{n.title}</strong>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{n.message}</p>
              </div>
              {!n.isRead && <button type="button" className="btn" onClick={() => markRead(n._id)}>Mark read</button>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}