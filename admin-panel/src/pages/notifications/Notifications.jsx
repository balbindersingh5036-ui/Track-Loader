import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Notifications() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications')
      .then(res => setData(res.data.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading notifications...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Notifications</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data.length === 0 ? (
          <li style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No notifications</li>
        ) : (
          data.map(n => (
            <li key={n._id} style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{n.title}</strong>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{n.message}</p>
              </div>
              {!n.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }} />}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}