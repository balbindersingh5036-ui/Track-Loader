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
import Banners from '../pages/banners/Banners';
import Notifications from '../pages/notifications/Notifications';
import Complaints from '../pages/complaints/Complaints';
import Ratings from '../pages/ratings/Ratings';
import Earnings from '../pages/earnings/Earnings';
import CustomerDetails from '../pages/customers/CustomerDetails';
import DriverDetails from '../pages/drivers/DriverDetails';
import BookingDetails from '../pages/bookings/BookingDetails';
import VehicleDetails from '../pages/vehicles/VehicleDetails';
import PaymentDetails from '../pages/payments/PaymentDetails';
import RatingDetails from '../pages/ratings/RatingDetails';
import ComplaintDetails from '../pages/complaints/ComplaintDetails';

import Agencies from '../pages/agencies/Agencies';
import AgencyDetails from '../pages/agencies/AgencyDetails';
import AgencyDashboard from '../pages/agency/AgencyDashboard';

const ProtectedRoute = ({ children, allowedRoles = ['admin'] }) => {
  const { token, user, restoring } = useSelector(state => state.auth);
  if (restoring) return <div>Verifying session...</div>;
  if (!token || !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" />;
  }
  return children;
};

const RootRedirect = () => {
  const { user } = useSelector(state => state.auth);
  if (user?.role === 'agency') {
    return <Navigate to="/agency/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={['admin', 'agency']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RootRedirect />} />
        
        {/* Super Admin Routes */}
        <Route path="dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="agencies" element={<ProtectedRoute allowedRoles={['admin']}><Agencies /></ProtectedRoute>} />
        <Route path="agencies/:id" element={<ProtectedRoute allowedRoles={['admin']}><AgencyDetails /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute allowedRoles={['admin']}><Bookings /></ProtectedRoute>} />
        <Route path="bookings/:id" element={<ProtectedRoute allowedRoles={['admin']}><BookingDetails /></ProtectedRoute>} />
        <Route path="customers" element={<ProtectedRoute allowedRoles={['admin']}><Customers /></ProtectedRoute>} />
        <Route path="customers/:id" element={<ProtectedRoute allowedRoles={['admin']}><CustomerDetails /></ProtectedRoute>} />
        <Route path="drivers" element={<ProtectedRoute allowedRoles={['admin']}><Drivers /></ProtectedRoute>} />
        <Route path="drivers/:id" element={<ProtectedRoute allowedRoles={['admin']}><DriverDetails /></ProtectedRoute>} />
        <Route path="vehicles" element={<ProtectedRoute allowedRoles={['admin']}><Vehicles /></ProtectedRoute>} />
        <Route path="vehicles/:id" element={<ProtectedRoute allowedRoles={['admin']}><VehicleDetails /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute allowedRoles={['admin']}><Payments /></ProtectedRoute>} />
        <Route path="payments/:id" element={<ProtectedRoute allowedRoles={['admin']}><PaymentDetails /></ProtectedRoute>} />
        <Route path="ratings" element={<ProtectedRoute allowedRoles={['admin']}><Ratings /></ProtectedRoute>} />
        <Route path="ratings/:id" element={<ProtectedRoute allowedRoles={['admin']}><RatingDetails /></ProtectedRoute>} />
        <Route path="earnings" element={<ProtectedRoute allowedRoles={['admin']}><Earnings /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
        <Route path="banners" element={<ProtectedRoute allowedRoles={['admin']}><Banners /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute allowedRoles={['admin']}><Notifications /></ProtectedRoute>} />
        <Route path="complaints" element={<ProtectedRoute allowedRoles={['admin']}><Complaints /></ProtectedRoute>} />
        <Route path="complaints/:id" element={<ProtectedRoute allowedRoles={['admin']}><ComplaintDetails /></ProtectedRoute>} />

        {/* Agency Owner Routes */}
        <Route path="agency/dashboard" element={<ProtectedRoute allowedRoles={['agency', 'admin']}><AgencyDashboard /></ProtectedRoute>} />

        <Route path="*" element={<RootRedirect />} />
      </Route>
    </Routes>
  );
}