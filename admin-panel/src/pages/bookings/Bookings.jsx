import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Bookings() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/bookings')
      .then(res => setData(res.data.data.bookings || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading bookings...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Bookings</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="5" style={{textAlign: 'center'}}>No bookings found</td></tr>
            ) : (
              data.map(item => (
                <tr key={item._id}>
                  <td>{item._id.slice(-6)}</td>
                  <td>{item.customer?.name || 'N/A'}</td>
                  <td>{item.driver?.name || 'Unassigned'}</td>
                  <td><span className={`badge default`}>{item.status}</span></td>
                  <td>₹{item.fare?.finalAmount || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}