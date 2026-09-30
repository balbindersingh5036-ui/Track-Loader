import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Drivers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/drivers')
      .then(res => setData(res.data.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading drivers...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Drivers</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Approval</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="4" style={{textAlign: 'center'}}>No drivers found</td></tr>
            ) : (
              data.map(item => (
                <tr key={item._id}>
                  <td>{item.user?.name || 'N/A'}</td>
                  <td>{item.user?.phone || 'N/A'}</td>
                  <td>{item.status}</td>
                  <td>{item.approvalStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}