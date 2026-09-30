import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Complaints() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/complaints')
      .then(res => setData(res.data.data || []))
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Backend API not available');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading complaints...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Complaints</h2>
      {error ? (
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan="4" style={{textAlign: 'center'}}>No complaints found</td></tr>
              ) : (
                data.map(item => (
                  <tr key={item._id}>
                    <td>{item._id.slice(-6)}</td>
                    <td>{item.user?.name || 'N/A'}</td>
                    <td>{item.subject}</td>
                    <td>{item.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}