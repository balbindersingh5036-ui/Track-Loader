import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard, Users, Car, Truck, Map, CreditCard,
  Settings, Bell, AlertTriangle, FileText, TrendingUp, Star, Image, Building2,
  UserPlus, PlusCircle, ShieldCheck, MapPin
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const isAgency = user?.role === 'agency';
  const [agencyTab, setAgencyTab] = useState('overview');
  const [agencyCounts, setAgencyCounts] = useState({ requests: null, drivers: null, vehicles: null, trips: null });
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    const handleAgencyTabChange = (event) => {
      if (typeof event.detail?.tab === 'string') {
        setAgencyTab(event.detail.tab);
      }
    };
    const handleAgencyCountsChange = (event) => {
      setAgencyCounts(event.detail || { requests: null, drivers: null, vehicles: null, trips: null });
    };
    const handleSidebarToggle = () => setMobileOpen(open => !open);

    window.addEventListener('agency-tab-change', handleAgencyTabChange);
    window.addEventListener('agency-dashboard-counts', handleAgencyCountsChange);
    window.addEventListener('toggle-admin-sidebar', handleSidebarToggle);
    return () => {
      window.removeEventListener('agency-tab-change', handleAgencyTabChange);
      window.removeEventListener('agency-dashboard-counts', handleAgencyCountsChange);
      window.removeEventListener('toggle-admin-sidebar', handleSidebarToggle);
    };
  }, []);

  const menuItems = adminMenuItems;

  const selectAgencyTab = (tab) => {
    setAgencyTab(tab);
    setMobileOpen(false);
    if (location.pathname !== '/agency/dashboard') {
      navigate('/agency/dashboard');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('agency-tab-select', { detail: { tab } }));
      }, 100);
      return;
    }
    window.dispatchEvent(new CustomEvent('agency-tab-select', { detail: { tab } }));
  };

  const handleQuickAction = (actionType) => {
    setMobileOpen(false);
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

  const agencyTabs = [
    { id: 'overview', name: 'Overview', icon: <LayoutDashboard /> },
    { id: 'requests', name: 'Driver Joining Requests', icon: <UserPlus />, count: agencyCounts.requests },
    { id: 'drivers', name: 'Drivers', icon: <Users />, count: agencyCounts.drivers },
    { id: 'vehicles', name: 'Fleet Vehicles', icon: <Truck />, count: agencyCounts.vehicles },
    { id: 'bookings', name: 'Fleet Trips', icon: <MapPin />, count: agencyCounts.trips },
    { id: 'profile', name: 'Profile & KYC', icon: <ShieldCheck /> }
  ];

  return (
    <>
      {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}
      <div className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <span style={{ color: 'var(--primary)', marginRight: '8px' }}>LB</span> {isAgency ? 'Agency Fleet' : 'Admin'}
        </div>
        <div className="sidebar-nav">
          {isAgency ? (
            <>
              <NavLink
                to="/agency/dashboard"
                className="nav-item agency-home-link"
                onClick={() => selectAgencyTab('overview')}
              >
                <LayoutDashboard />
                <span>Agency Fleet</span>
              </NavLink>
              <div className="sidebar-section-title">Main Navigation</div>
              {agencyTabs.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item agency-tab-link${agencyTab === item.id ? ' active' : ''}`}
                  aria-current={agencyTab === item.id ? 'page' : undefined}
                  onClick={() => selectAgencyTab(item.id)}
                >
                  {item.icon}
                  <span>{item.name}</span>
                  {item.count != null && <span className="sidebar-count">{item.count}</span>}
                </button>
              ))}
            </>
          ) : menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}

          {isAgency && (
            <>
              <div className="sidebar-section-title" style={{ marginTop: '20px' }}>Quick Actions</div>
              <button
                type="button"
                className="nav-item action-btn"
                onClick={() => handleQuickAction('register-driver')}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <UserPlus size={16} />
                <span>+ Register Driver</span>
              </button>
              <button
                type="button"
                className="nav-item action-btn"
                onClick={() => handleQuickAction('add-vehicle')}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <PlusCircle size={16} />
                <span>+ Add Vehicle</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
