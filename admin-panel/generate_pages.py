import os

files = {}

files["src/pages/bookings/Bookings.jsx"] = """
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
"""

files["src/pages/customers/Customers.jsx"] = """
import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Customers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/customers')
      .then(res => setData(res.data.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading customers...</div>;

  return (
    <div className="card">
      <h2 className="card-title">Customers</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="4" style={{textAlign: 'center'}}>No customers found</td></tr>
            ) : (
              data.map(item => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td><span className="badge success">{item.status || 'Active'}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
"""

files["src/pages/drivers/Drivers.jsx"] = """
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
"""

files["src/pages/vehicles/Vehicles.jsx"] = """
import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export default function Vehicles() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/vehicles')
      .then(res => setData(res.data.data || []))
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
                  <td>{item.model}</td>
                  <td>{item.type}</td>
                  <td>{item.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
"""

files["src/pages/payments/Payments.jsx"] = """
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
"""

files["src/pages/reports/Reports.jsx"] = """
import React from 'react';

export default function Reports() {
  return (
    <div className="card">
      <h2 className="card-title">Reports</h2>
      <p>Analytics and reports are currently being generated from live data. Select a report type above to view.</p>
    </div>
  );
}
"""

files["src/pages/Settings.jsx"] = """
import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/settings')
      .then(res => setSettings(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="card">
      <h2 className="card-title">System Settings</h2>
      {settings ? (
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      ) : (
        <p>No configuration found.</p>
      )}
    </div>
  );
}
"""

files["src/pages/notifications/Notifications.jsx"] = """
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
"""

files["src/pages/complaints/Complaints.jsx"] = """
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
"""

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + "\\n")

print("Stage 3 complete.")
