import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, Map, CreditCard, 
  Settings, Bell, AlertTriangle, FileText, TrendingUp, Star
} from 'lucide-react';

export default function Sidebar() {
  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard /> },
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