import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  LayoutDashboard, Users, Car, Map, CreditCard, 
  Settings, Bell, AlertTriangle, FileText, TrendingUp, Star, Image, Building2,
  UserPlus, PlusCircle, ShieldCheck, MapPin
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const isAgency = user?.role === 'agency';

  const adminMenuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard /> },
    { path: '/agencies', name: 'Agencies', icon: <Building2 /> },
    { path: '/bookings', name: 'Bookings', icon: <Map /> },
    { path: '/customers', name: 'Customers', icon: <Users /> },
    { path: '/drivers', name: 'Drivers', icon: <Users /> },
    { path: '/vehicles', name: 'Vehicles', icon: <Car /> },
    { path: '/payments', name: 'Payments', icon: <CreditCard /> },
    { path: '/ratings', name: 'Ratings', icon: <Star /> },
    { path: '/earnings', name: 'Earnings', icon: <TrendingUp /> },
    { path: '/notifications', name: 'Notifications', icon: <Bell /> },
    { path: '/complaints', name: 'Complaints', icon: <AlertTriangle /> },
    { path: '/reports', name: 'Reports', icon: <FileText /> },
    { path: '/banners', name: 'Banners', icon: <Image /> },
    { path: '/settings', name: 'System Settings', icon: <Settings /> },
  ];

  const agencyMenuItems = [
    { path: '/agency/dashboard', name: 'Agency Fleet', icon: <LayoutDashboard /> }
  ];

  const menuItems = isAgency ? agencyMenuItems : adminMenuItems;

  const handleQuickAction = (actionType) => {
    // If not on agency dashboard, navigate there first
    if (location.pathname !== '/agency/dashboard') {
      navigate('/agency/dashboard');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('agency-quick-action', { detail: { action: actionType } }));
      }, 100);
    } else {
      window.dispatchEvent(new CustomEvent('agency-quick-action', { detail: { action: actionType } }));
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span style={{ color: 'var(--primary)', marginRight: '8px' }}>LB</span> {isAgency ? 'Agency Fleet' : 'Admin'}
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

        {isAgency && (
          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px' }}>
            <div className="sidebar-section-title">
              Quick Actions
            </div>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => handleQuickAction('register-driver')}
              title="Register a new commercial driver"
            >
              <UserPlus color="#38bdf8" />
              <span>Register Driver</span>
            </button>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => handleQuickAction('add-vehicle')}
              title="Add a new commercial vehicle to fleet"
            >
              <PlusCircle color="#4ade80" />
              <span>Add Fleet Vehicle</span>
            </button>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => handleQuickAction('agency-kyc-profile')}
              title="View & update agency profile and KYC documents"
            >
              <ShieldCheck color="#fbbf24" />
              <span>Agency KYC & Profile</span>
            </button>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => handleQuickAction('view-fleet-trips')}
              title="View commercial dispatches and bookings"
            >
              <MapPin color="#a78bfa" />
              <span>View Fleet Trips</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}