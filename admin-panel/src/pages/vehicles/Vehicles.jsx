import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Vehicles() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/vehicles')
      .then(res => setData(res.data.data.vehicles || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading vehicles...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Vehicles</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Model</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="4" style={{textAlign: 'center'}}>No vehicles found</td></tr>
            ) : (
              data.map(item => (
                <tr key={item._id}>
                  <td>{item.vehicleNumber}</td>
                  <td>{item.vehicleModel}</td>
                  <td>{item.vehicleType}</td>
                  <td>{item.isActive ? (item.isAvailable ? 'Available' : 'Unavailable') : 'Inactive'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}