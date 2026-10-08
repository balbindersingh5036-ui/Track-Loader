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
        <Route path="bookings/:id" element={<BookingDetails />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetails />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="drivers/:id" element={<DriverDetails />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="vehicles/:id" element={<VehicleDetails />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/:id" element={<PaymentDetails />} />
        <Route path="ratings" element={<Ratings />} />
        <Route path="ratings/:id" element={<RatingDetails />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="banners" element={<Banners />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/:id" element={<ComplaintDetails />} />
        {/* other routes will go here, currently map to dashboard for safety if not defined fully */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}