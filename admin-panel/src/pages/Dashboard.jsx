import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Map, DollarSign, Users, Car } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [reportRes, bookingRes] = await Promise.all([
          api.get('/admin/reports/dashboard'),
          api.get('/admin/bookings?limit=5')
        ]);
        setData({
          metrics: reportRes.data.data,
          recentBookings: bookingRes.data.data.bookings || []
        });
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;
  if (!data) return <div>No data available</div>;

  const { metrics, recentBookings } = data;

  const kpis = [
    { label: 'Total Bookings', value: metrics?.totalBookings || 0, icon: <Map size={24} /> },
    { label: 'Total Revenue', value: `₹${metrics?.totalRevenue || 0}`, icon: <DollarSign size={24} /> },
    { label: 'Total Customers', value: metrics?.totalCustomers || 0, icon: <Users size={24} /> },
    { label: 'Total Drivers', value: metrics?.totalDrivers || 0, icon: <Car size={24} /> }
  ];

  const chartData = metrics?.revenueChart || [
    { name: 'Mon', revenue: 4000 },
    { name: 'Tue', revenue: 3000 },
    { name: 'Wed', revenue: 2000 },
    { name: 'Thu', revenue: 2780 },
    { name: 'Fri', revenue: 1890 },
    { name: 'Sat', revenue: 2390 },
    { name: 'Sun', revenue: 3490 },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>Dashboard Overview</h2>
      
      <div className="dashboard-grid">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="card stat-card">
            <div className="stat-icon">{kpi.icon}</div>
            <div className="stat-info">
              <h4>{kpi.label}</h4>
              <div className="value">{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '24px', height: '400px' }}>
        <h3 className="card-title">Revenue Chart</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="card-title">Recent Bookings</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Pickup → Drop</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>No recent bookings</td>
                </tr>
              ) : (
                recentBookings.map(b => (
                  <tr key={b._id}>
                    <td>{b._id.slice(-6)}</td>
                    <td>{b.customer?.name || 'N/A'}</td>
                    <td>{b.pickupLocation?.address} → {b.dropLocation?.address}</td>
                    <td><span className={`badge ${b.status === 'completed' ? 'success' : 'warning'}`}>{b.status}</span></td>
                    <td>₹{b.fare?.finalAmount || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}