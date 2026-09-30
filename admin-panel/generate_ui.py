import os

files = {}

files["src/pages/auth/Login.jsx"] = """
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, fetchProfile } from '../../store/slices/authSlice';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resultAction = await dispatch(login({ email, password }));
    if (login.fulfilled.match(resultAction)) {
      await dispatch(fetchProfile());
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: 'var(--primary)', marginBottom: '8px' }}>LoadBalbin</h1>
          <h2>Admin Panel</h2>
        </div>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@loadbalbin.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
"""

files["src/components/layout/Sidebar.jsx"] = """
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Map, CreditCard, 
  Settings, Bell, AlertTriangle, FileText, TrendingUp
} from 'lucide-react';

export default function Sidebar() {
  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard /> },
    { path: '/bookings', name: 'Bookings', icon: <Map /> },
    { path: '/customers', name: 'Customers', icon: <Users /> },
    { path: '/drivers', name: 'Drivers', icon: <Users /> },
    { path: '/vehicles', name: 'Vehicles', icon: <Car /> },
    { path: '/payments', name: 'Payments', icon: <CreditCard /> },
    { path: '/earnings', name: 'Earnings', icon: <TrendingUp /> },
    { path: '/notifications', name: 'Notifications', icon: <Bell /> },
    { path: '/complaints', name: 'Complaints', icon: <AlertTriangle /> },
    { path: '/reports', name: 'Reports', icon: <FileText /> },
    { path: '/settings', name: 'System Settings', icon: <Settings /> },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span style={{ color: 'var(--primary)', marginRight: '8px' }}>LB</span> Admin
      </div>
      <div className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
"""

files["src/components/layout/Header.jsx"] = """
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { Bell, Search, User } from 'lucide-react';
import api from '../../services/api';

export default function Header() {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notifications count
    api.get('/notifications/unread-count')
      .then(res => setUnreadCount(res.data.data.count || 0))
      .catch(err => console.error(err));
  }, []);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: '8px 16px', borderRadius: '8px', width: '300px' }}>
        <Search size={18} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
        <input type="text" placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0 }} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={24} color="var(--text-secondary)" />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{user?.name || 'Admin User'}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.role === 'admin' ? 'Super Admin' : user?.role}</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ marginLeft: '16px', border: '1px solid var(--border-color)' }}>Logout</button>
        </div>
      </div>
    </header>
  );
}
"""

files["src/components/layout/AdminLayout.jsx"] = """
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
"""

files["src/pages/Dashboard.jsx"] = """
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
"""

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + "\\n")

print("Stage 2 complete.")
