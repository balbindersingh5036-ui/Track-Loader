import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from '../pages/auth/Login';
import AdminLayout from '../components/layout/AdminLayout';
import Dashboard from '../pages/Dashboard';
import Bookings from '../pages/bookings/Bookings';
import Customers from '../pages/customers/Customers';
import Drivers from '../pages/drivers/Drivers';
import Vehicles from '../pages/vehicles/Vehicles';
import Payments from '../pages/payments/Payments';
import Reports from '../pages/reports/Reports';
import Settings from '../pages/Settings';
import Notifications from '../pages/notifications/Notifications';
import Complaints from '../pages/complaints/Complaints';

const ProtectedRoute = ({ children }) => {
  const { token, user, restoring } = useSelector(state => state.auth);
  if (restoring) return <div>Verifying admin session...</div>;
  if (!token || user?.role !== 'admin') {
    return <Navigate to="/login" />;
  }
  return children;
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="customers" element={<Customers />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="complaints" element={<Complaints />} />
        {/* other routes will go here, currently map to dashboard for safety if not defined fully */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}