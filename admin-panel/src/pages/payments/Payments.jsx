import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Payments() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/payments')
      .then(res => setData(res.data.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading payments...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Payments</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="5" style={{textAlign: 'center'}}>No payments found</td></tr>
            ) : (
              data.map(item => (
                <tr key={item._id}>
                  <td>{item._id.slice(-6)}</td>
                  <td>{item.booking?.slice(-6) || 'N/A'}</td>
                  <td>₹{item.amount}</td>
                  <td><span className="badge default">{item.status}</span></td>
                  <td>{item.method}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}