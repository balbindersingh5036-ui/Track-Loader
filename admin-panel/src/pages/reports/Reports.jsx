import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import './reports.css';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  UserCheck,
  Truck,
  Car,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  RefreshCw,
  Star,
  Search,
  Package,
  CreditCard,
  ArrowUpDown,
  Clock,
  Ban,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  Activity
} from 'lucide-react';

const STATUS_COLORS = {
  completed: '#10b981',
  'in-progress': '#3b82f6',
  accepted: '#6366f1',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  rejected: '#e11d48',
  success: '#10b981',
  failed: '#ef4444',
  refunded: '#8b5cf6'
};

const CHART_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const formatINR = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const formatNum = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const downloadCsv = (filename, headers, rows) => {
  if (!rows || rows.length === 0) {
    alert('No records available to export for the selected date range.');
    return;
  }
  const csvRows = [];
  csvRows.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','));
  for (const row of rows) {
    csvRows.push(row.map((val) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));
  }
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeDateRange, setActiveDateRange] = useState({ from: '', to: '' });

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState('');

  // Data states
  const [dashboard, setDashboard] = useState(null);
  const [bookingsReport, setBookingsReport] = useState(null);
  const [revenueReport, setRevenueReport] = useState(null);
  const [customersReport, setCustomersReport] = useState(null);
  const [driversReport, setDriversReport] = useState(null);
  const [vehiclesReport, setVehiclesReport] = useState(null);
  const [paymentsReport, setPaymentsReport] = useState(null);
  const [ratingsReport, setRatingsReport] = useState(null);
  const [complaintsReport, setComplaintsReport] = useState(null);

  // Table tabs and pagination
  const [activeTab, setActiveTab] = useState('bookings');
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Handle Date Preset Calculation
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setActiveDateRange({ from: todayStr, to: todayStr });
    } else if (preset === '7days') {
      const past = new Date(Date.now() - 7 * 86400000);
      setActiveDateRange({ from: past.toISOString().split('T')[0], to: todayStr });
    } else if (preset === '30days') {
      const past = new Date(Date.now() - 30 * 86400000);
      setActiveDateRange({ from: past.toISOString().split('T')[0], to: todayStr });
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setActiveDateRange({ from: firstDay.toISOString().split('T')[0], to: todayStr });
    } else if (preset === 'all') {
      setActiveDateRange({ from: '', to: '' });
      setCustomFrom('');
      setCustomTo('');
    }
  };

  const applyCustomRange = (e) => {
    e.preventDefault();
    if (customFrom && customTo && customFrom > customTo) {
      alert("'From' date cannot be after 'To' date");
      return;
    }
    setDatePreset('custom');
    setActiveDateRange({ from: customFrom, to: customTo });
  };

  // Concurrent Report Fetching
  const fetchAllReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (activeDateRange.from) params.from = activeDateRange.from;
      if (activeDateRange.to) params.to = activeDateRange.to;

      const [
        dashRes,
        bookRes,
        revRes,
        custRes,
        drivRes,
        vehRes,
        payRes,
        ratRes,
        compRes
      ] = await Promise.all([
        api.get('/admin/reports/dashboard'),
        api.get('/admin/reports/bookings', { params }),
        api.get('/admin/reports/revenue', { params }),
        api.get('/admin/reports/customers', { params }),
        api.get('/admin/reports/drivers', { params }),
        api.get('/admin/reports/vehicles'),
        api.get('/admin/reports/payments', { params }),
        api.get('/admin/reports/ratings'),
        api.get('/admin/reports/complaints', { params })
      ]);

      setDashboard(dashRes.data?.data || {});
      setBookingsReport(bookRes.data?.data || {});
      setRevenueReport(revRes.data?.data || {});
      setCustomersReport(custRes.data?.data || {});
      setDriversReport(drivRes.data?.data || {});
      setVehiclesReport(vehRes.data?.data || {});
      setPaymentsReport(payRes.data?.data || {});
      setRatingsReport(ratRes.data?.data || {});
      setComplaintsReport(compRes.data?.data || {});
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [activeDateRange]);

  useEffect(() => {
    fetchAllReports();
  }, [fetchAllReports]);

  // Export Handlers
  const handleExportBookings = async () => {
    if (exporting) return;
    setExporting('bookings');
    try {
      const params = {};
      if (activeDateRange.from) params.from = activeDateRange.from;
      if (activeDateRange.to) params.to = activeDateRange.to;

      const res = await api.get('/admin/reports/bookings/export', { params });
      const records = res.data?.data?.exportData || [];
      const headers = [
        'Booking ID',
        'Created At',
        'Status',
        'Payment Status',
        'Vehicle Type',
        'Estimated Fare (INR)',
        'Final Fare (INR)',
        'Customer Name',
        'Customer Phone',
        'Driver Name'
      ];
      const rows = records.map((b) => [
        b.bookingId || '',
        b.createdAt ? new Date(b.createdAt).toLocaleString('en-IN') : '',
        b.status || '',
        b.paymentStatus || '',
        b.vehicleType || '',
        b.estimatedFare || 0,
        b.finalFare || 0,
        b.customerName || '',
        b.customerPhone || '',
        b.driverName || 'Unassigned'
      ]);
      const filename = `loadbalbin-bookings-${activeDateRange.from || 'all'}-to-${activeDateRange.to || 'latest'}.csv`;
      downloadCsv(filename, headers, rows);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to export bookings.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPayments = async () => {
    if (exporting) return;
    setExporting('payments');
    try {
      const params = {};
      if (activeDateRange.from) params.from = activeDateRange.from;
      if (activeDateRange.to) params.to = activeDateRange.to;

      const res = await api.get('/admin/reports/payments/export', { params });
      const records = res.data?.data?.exportData || [];
      const headers = [
        'Payment ID',
        'Transaction ID',
        'Order ID',
        'Date & Time',
        'Status',
        'Method',
        'Amount (INR)',
        'Refund Amount (INR)',
        'Customer Name',
        'Customer Phone'
      ];
      const rows = records.map((p) => [
        p.paymentId || '',
        p.transactionId || '',
        p.orderId || '',
        p.createdAt ? new Date(p.createdAt).toLocaleString('en-IN') : '',
        p.status || '',
        p.method || '',
        p.amount || 0,
        p.refundAmount || 0,
        p.customerName || '',
        p.customerPhone || ''
      ]);
      const filename = `loadbalbin-payments-${activeDateRange.from || 'all'}-to-${activeDateRange.to || 'latest'}.csv`;
      downloadCsv(filename, headers, rows);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to export payments.');
    } finally {
      setExporting(null);
    }
  };

  // Booking Status Distribution Data
  const bookingPieData = useMemo(() => {
    const byStatus = bookingsReport?.byStatus || [];
    if (byStatus.length > 0) {
      return byStatus.map((item) => ({
        name: (item._id || 'unknown').toUpperCase(),
        value: item.count || 0,
        color: STATUS_COLORS[item._id] || '#64748b'
      }));
    }
    // Fallback to dashboard booking counts
    if (dashboard) {
      const fallback = [
        { name: 'COMPLETED', value: dashboard.completedBookings || 0, color: STATUS_COLORS.completed },
        { name: 'IN PROGRESS', value: dashboard.inProgressBookings || 0, color: STATUS_COLORS['in-progress'] },
        { name: 'ACCEPTED', value: dashboard.acceptedBookings || 0, color: STATUS_COLORS.accepted },
        { name: 'PENDING', value: dashboard.pendingBookings || 0, color: STATUS_COLORS.pending },
        { name: 'CANCELLED', value: dashboard.cancelledBookings || 0, color: STATUS_COLORS.cancelled },
        { name: 'REJECTED', value: dashboard.rejectedBookings || 0, color: STATUS_COLORS.rejected }
      ].filter((x) => x.value > 0);
      return fallback;
    }
    return [];
  }, [bookingsReport, dashboard]);

  // Revenue Series Data
  const revenueChartData = useMemo(() => {
    const series = revenueReport?.series || [];
    return series.map((s) => ({
      date: s._id,
      revenue: s.revenue || 0
    }));
  }, [revenueReport]);

  // Daily Bookings Data
  const dailyBookingsData = useMemo(() => {
    const daily = bookingsReport?.daily || [];
    return daily.map((d) => ({
      date: d._id,
      count: d.count || 0
    }));
  }, [bookingsReport]);

  // Vehicle Type Data
  const vehicleTypeData = useMemo(() => {
    const types = vehiclesReport?.vehiclesByVehicleType || [];
    return types.map((t) => ({
      name: (t._id || 'Standard').replace(/-/g, ' ').toUpperCase(),
      count: t.count || 0
    }));
  }, [vehiclesReport]);

  // Payment Method Breakdown Data
  const paymentMethodData = useMemo(() => {
    const methods = paymentsReport?.methodBreakdown || [];
    return methods.map((m, i) => ({
      name: (m._id || 'Unknown').toUpperCase(),
      value: m.count || 0,
      color: CHART_PALETTE[i % CHART_PALETTE.length]
    }));
  }, [paymentsReport]);

  // Table Data Filtered by Search & Tab
  const tableData = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();

    if (activeTab === 'bookings') {
      const byStatus = bookingsReport?.byStatus || [];
      const byVeh = bookingsReport?.byVehicleType || [];
      const list = [
        ...byStatus.map((s) => ({ type: 'Booking Status', key: s._id, count: s.count })),
        ...byVeh.map((v) => ({ type: 'Vehicle Category', key: v._id, count: v.count }))
      ];
      if (!q) return list;
      return list.filter((item) => item.key?.toLowerCase().includes(q) || item.type.toLowerCase().includes(q));
    }

    if (activeTab === 'payments') {
      const methods = paymentsReport?.methodBreakdown || [];
      const providers = paymentsReport?.providerBreakdown || [];
      const list = [
        ...methods.map((m) => ({ category: 'Payment Method', name: m._id, count: m.count })),
        ...providers.map((p) => ({ category: 'Gateway Provider', name: p._id, count: p.count }))
      ];
      if (!q) return list;
      return list.filter((item) => item.name?.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
    }

    if (activeTab === 'drivers') {
      const drivers = driversReport?.topDrivers || [];
      if (!q) return drivers;
      return drivers.filter((d) => d.fullName?.toLowerCase().includes(q) || d.phone?.includes(q));
    }

    if (activeTab === 'customers') {
      const customers = customersReport?.topCustomersByBookings || [];
      if (!q) return customers;
      return customers.filter((c) =>
        c.customerObj?.name?.toLowerCase().includes(q) ||
        c.customerObj?.phone?.includes(q) ||
        c.customerObj?.email?.toLowerCase().includes(q)
      );
    }

    if (activeTab === 'vehicles') {
      const byType = vehiclesReport?.vehiclesByVehicleType || [];
      const byBody = vehiclesReport?.vehiclesByBodyType || [];
      const list = [
        ...byType.map((v) => ({ category: 'Vehicle Type', name: v._id, count: v.count })),
        ...byBody.map((b) => ({ category: 'Body Type', name: b._id, count: b.count }))
      ];
      if (!q) return list;
      return list.filter((item) => item.name?.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
    }

    if (activeTab === 'complaints') {
      const complaints = complaintsReport?.recentComplaints || [];
      if (!q) return complaints;
      return complaints.filter((c) =>
        c.subject?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        c.raisedBy?.name?.toLowerCase().includes(q)
      );
    }

    return [];
  }, [activeTab, bookingsReport, paymentsReport, driversReport, customersReport, vehiclesReport, complaintsReport, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(tableData.length / pageSize));
  const paginatedTableData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tableData.slice(start, start + pageSize);
  }, [tableData, page, pageSize]);

  return (
    <div className="reports-dashboard">
      {/* 1. PROFESSIONAL DASHBOARD HEADER */}
      <header className="reports-header">
        <div className="reports-header-top">
          <div className="reports-title-area">
            <h1>
              <Activity size={26} color="#1677ff" />
              Reports & Analytics
            </h1>
            <p>Business performance, delivery metrics and operational insights.</p>
          </div>

          <div className="reports-header-actions">
            <button
              type="button"
              className="reports-btn reports-btn-export"
              onClick={handleExportBookings}
              disabled={loading || exporting === 'bookings'}
              title="Download booking analytics as CSV"
            >
              <FileSpreadsheet size={16} />
              {exporting === 'bookings' ? 'Exporting...' : 'Export Bookings'}
            </button>

            <button
              type="button"
              className="reports-btn reports-btn-export"
              onClick={handleExportPayments}
              disabled={loading || exporting === 'payments'}
              title="Download payment ledger as CSV"
            >
              <Download size={16} />
              {exporting === 'payments' ? 'Exporting...' : 'Export Payments'}
            </button>

            <button
              type="button"
              className="reports-btn reports-btn-primary"
              onClick={fetchAllReports}
              disabled={loading}
              title="Refresh all metrics from the backend"
            >
              <RefreshCw size={15} className={loading ? 'skeleton-shimmer' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Refreshing...' : 'Refresh Reports'}
            </button>
          </div>
        </div>

        {/* DATE RANGE SELECTOR BAR */}
        <div className="reports-filters-bar">
          <div className="date-preset-pills">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={14} /> Timeframe:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'thisMonth', label: 'This Month' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`date-pill ${datePreset === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetChange(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form className="custom-range-inputs" onSubmit={applyCustomRange}>
            <label htmlFor="custom-from">From:</label>
            <input
              id="custom-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              required
            />
            <label htmlFor="custom-to">To:</label>
            <input
              id="custom-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              required
            />
            <button type="submit" className="reports-btn" style={{ padding: '4px 10px', fontSize: 12 }}>
              Apply
            </button>
          </form>
        </div>
      </header>

      {/* ERROR NOTICE */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '14px 18px', borderRadius: 10, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={18} />
          <span style={{ fontWeight: 500, fontSize: 13.5 }}>{error}</span>
          <button type="button" onClick={fetchAllReports} className="reports-btn" style={{ marginLeft: 'auto', fontSize: 12 }}>
            Retry
          </button>
        </div>
      )}

      {/* 2. REVENUE & FINANCIAL KPIS */}
      <section className="kpi-section">
        <div className="section-label-row">
          <div className="section-label">
            <DollarSign size={15} /> Financial & Revenue Performance
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card kpi-emerald">
            <div className="kpi-content">
              <span className="kpi-title">Total Revenue (Net)</span>
              <span className="kpi-value">{loading ? '—' : formatINR(dashboard?.totalRevenue)}</span>
              <span className="kpi-subtext">After refunds deducted</span>
            </div>
            <div className="kpi-icon-box"><DollarSign size={24} /></div>
          </div>

          <div className="kpi-card kpi-blue">
            <div className="kpi-content">
              <span className="kpi-title">Total Paid Amount</span>
              <span className="kpi-value">{loading ? '—' : formatINR(dashboard?.totalPaidAmount)}</span>
              <span className="kpi-subtext">Successful gross collections</span>
            </div>
            <div className="kpi-icon-box"><CreditCard size={24} /></div>
          </div>

          <div className="kpi-card kpi-rose">
            <div className="kpi-content">
              <span className="kpi-title">Total Refunded Amount</span>
              <span className="kpi-value">{loading ? '—' : formatINR(dashboard?.totalRefundedAmount)}</span>
              <span className="kpi-subtext">Processed customer refunds</span>
            </div>
            <div className="kpi-icon-box"><ArrowUpDown size={24} /></div>
          </div>

          <div className="kpi-card kpi-purple">
            <div className="kpi-content">
              <span className="kpi-title">Average Platform Rating</span>
              <span className="kpi-value">
                {loading ? '—' : `${dashboard?.averageRating || 0} ★`}
              </span>
              <span className="kpi-subtext">From verified customer reviews</span>
            </div>
            <div className="kpi-icon-box"><Star size={24} /></div>
          </div>
        </div>
      </section>

      {/* 3. BOOKING OPERATION KPIS */}
      <section className="kpi-section">
        <div className="section-label-row">
          <div className="section-label">
            <Package size={15} /> Booking & Delivery Operations
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card kpi-blue">
            <div className="kpi-content">
              <span className="kpi-title">Total Bookings</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.totalBookings)}</span>
              <span className="kpi-subtext">All time reservations</span>
            </div>
            <div className="kpi-icon-box"><Package size={24} /></div>
          </div>

          <div className="kpi-card kpi-emerald">
            <div className="kpi-content">
              <span className="kpi-title">Completed Deliveries</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.completedBookings)}</span>
              <span className="kpi-subtext">Successfully fulfilled trips</span>
            </div>
            <div className="kpi-icon-box"><CheckCircle size={24} /></div>
          </div>

          <div className="kpi-card kpi-indigo">
            <div className="kpi-content">
              <span className="kpi-title">In-Progress Trips</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.inProgressBookings)}</span>
              <span className="kpi-subtext">Active on-road loads</span>
            </div>
            <div className="kpi-icon-box"><TrendingUp size={24} /></div>
          </div>

          <div className="kpi-card kpi-cyan">
            <div className="kpi-content">
              <span className="kpi-title">Accepted Bookings</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.acceptedBookings)}</span>
              <span className="kpi-subtext">Confirmed by assigned drivers</span>
            </div>
            <div className="kpi-icon-box"><CheckCircle2 size={24} /></div>
          </div>

          <div className="kpi-card kpi-amber">
            <div className="kpi-content">
              <span className="kpi-title">Pending Bookings</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.pendingBookings)}</span>
              <span className="kpi-subtext">Awaiting driver assignment</span>
            </div>
            <div className="kpi-icon-box"><Clock size={24} /></div>
          </div>

          <div className="kpi-card kpi-rose">
            <div className="kpi-content">
              <span className="kpi-title">Cancelled Bookings</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.cancelledBookings)}</span>
              <span className="kpi-subtext">Cancelled by customer/agency</span>
            </div>
            <div className="kpi-icon-box"><Ban size={24} /></div>
          </div>

          <div className="kpi-card kpi-orange">
            <div className="kpi-content">
              <span className="kpi-title">Rejected Bookings</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.rejectedBookings)}</span>
              <span className="kpi-subtext">Declined trip requests</span>
            </div>
            <div className="kpi-icon-box"><XCircle size={24} /></div>
          </div>

          <div className="kpi-card kpi-rose">
            <div className="kpi-content">
              <span className="kpi-title">Open Complaints</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.openComplaints)}</span>
              <span className="kpi-subtext">Tickets needing attention</span>
            </div>
            <div className="kpi-icon-box"><AlertCircle size={24} /></div>
          </div>
        </div>
      </section>

      {/* 4. FLEET, DRIVERS & CUSTOMERS KPIS */}
      <section className="kpi-section">
        <div className="section-label-row">
          <div className="section-label">
            <Users size={15} /> Network, Partners & Customers
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card kpi-blue">
            <div className="kpi-content">
              <span className="kpi-title">Total Customers</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.totalCustomers)}</span>
              <span className="kpi-subtext">Registered shipper accounts</span>
            </div>
            <div className="kpi-icon-box"><Users size={24} /></div>
          </div>

          <div className="kpi-card kpi-emerald">
            <div className="kpi-content">
              <span className="kpi-title">Active Customers</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.activeCustomers)}</span>
              <span className="kpi-subtext">Verified & operational users</span>
            </div>
            <div className="kpi-icon-box"><UserCheck size={24} /></div>
          </div>

          <div className="kpi-card kpi-indigo">
            <div className="kpi-content">
              <span className="kpi-title">Total Registered Drivers</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.totalDrivers)}</span>
              <span className="kpi-subtext">Fleet partner drivers</span>
            </div>
            <div className="kpi-icon-box"><Truck size={24} /></div>
          </div>

          <div className="kpi-card kpi-emerald">
            <div className="kpi-content">
              <span className="kpi-title">Approved Drivers</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.approvedDrivers)}</span>
              <span className="kpi-subtext">KYC approved & eligible</span>
            </div>
            <div className="kpi-icon-box"><CheckCircle2 size={24} /></div>
          </div>

          <div className="kpi-card kpi-amber">
            <div className="kpi-content">
              <span className="kpi-title">Pending Drivers</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.pendingDrivers)}</span>
              <span className="kpi-subtext">Awaiting admin KYC verification</span>
            </div>
            <div className="kpi-icon-box"><Clock size={24} /></div>
          </div>

          <div className="kpi-card kpi-cyan">
            <div className="kpi-content">
              <span className="kpi-title">Total Fleet Vehicles</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.totalVehicles)}</span>
              <span className="kpi-subtext">Registered commercial units</span>
            </div>
            <div className="kpi-icon-box"><Car size={24} /></div>
          </div>

          <div className="kpi-card kpi-emerald">
            <div className="kpi-content">
              <span className="kpi-title">Active Vehicles</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.activeVehicles)}</span>
              <span className="kpi-subtext">Approved roadworthy vehicles</span>
            </div>
            <div className="kpi-icon-box"><CheckCircle size={24} /></div>
          </div>

          <div className="kpi-card kpi-blue">
            <div className="kpi-content">
              <span className="kpi-title">Available Vehicles</span>
              <span className="kpi-value">{loading ? '—' : formatNum(dashboard?.availableVehicles)}</span>
              <span className="kpi-subtext">Ready for immediate dispatch</span>
            </div>
            <div className="kpi-icon-box"><Truck size={24} /></div>
          </div>
        </div>
      </section>

      {/* 5. CHARTS & ANALYTICS VISUALIZATION */}
      <section className="charts-grid-2col">
        {/* CHART 1: BOOKING STATUS DISTRIBUTION */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h3>Booking Status Breakdown</h3>
              <p>Distribution across all delivery lifecycle phases</p>
            </div>
          </div>
          <div className="chart-container-box">
            {bookingPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bookingPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {bookingPieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${formatNum(value)} bookings`, name]} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <Package size={28} />
                <span>No booking status data available for this timeframe</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: REVENUE TRENDS OVER TIME */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h3>Revenue Trajectory</h3>
              <p>Gross payment collections over time</p>
            </div>
          </div>
          <div className="chart-container-box">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1677ff" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1677ff" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip formatter={(value) => [formatINR(value), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#1677ff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <DollarSign size={28} />
                <span>No daily revenue data available in this date range</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART 3: DAILY BOOKINGS VOLUME */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h3>Daily Bookings Volume</h3>
              <p>Trip booking frequency trends</p>
            </div>
          </div>
          <div className="chart-container-box">
            {dailyBookingsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBookingsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} bookings`, 'Volume']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <TrendingUp size={28} />
                <span>No daily booking activity recorded in this period</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART 4: VEHICLE FLEET COMPOSITION */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-area">
              <h3>Vehicle Fleet Categories</h3>
              <p>Active fleet distribution by transport type</p>
            </div>
          </div>
          <div className="chart-container-box">
            {vehicleTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleTypeData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
                  <Tooltip formatter={(value) => [`${value} vehicles`, 'Fleet Count']} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <Truck size={28} />
                <span>No fleet vehicle type data available</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. DETAILED REPORT TABLES */}
      <section className="tables-card">
        {/* TABS HEADER */}
        <div className="tables-tabs-bar">
          {[
            { id: 'bookings', label: 'Booking Breakdown', icon: Package },
            { id: 'payments', label: 'Payment Channels', icon: CreditCard },
            { id: 'drivers', label: 'Top Drivers', icon: Truck },
            { id: 'customers', label: 'Top Customers', icon: Users },
            { id: 'vehicles', label: 'Fleet Utilization', icon: Car },
            { id: 'complaints', label: 'Recent Complaints', icon: AlertCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`table-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                  setTableSearch('');
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SEARCH AND CONTROLS */}
        <div className="tables-controls-bar">
          <div className="table-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="table-records-count">
            Showing {paginatedTableData.length} of {tableData.length} items
          </div>
        </div>

        {/* TABLE CONTENT BY ACTIVE TAB */}
        <div className="report-table-wrapper">
          {activeTab === 'bookings' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Status / Type</th>
                  <th>Total Count</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No booking data found</td></tr>
                ) : (
                  paginatedTableData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{row.type}</td>
                      <td>
                        <span className={`status-pill status-${String(row.key).toLowerCase()}`}>
                          {String(row.key || 'standard').replace(/-/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatNum(row.count)}</td>
                      <td style={{ color: '#64748b' }}>
                        {dashboard?.totalBookings ? `${((row.count / dashboard.totalBookings) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'payments' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Channel Classification</th>
                  <th>Method / Provider Name</th>
                  <th>Transactions Processed</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No payment channel data found</td></tr>
                ) : (
                  paginatedTableData.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{row.category}</td>
                      <td>
                        <span className="status-pill status-in-progress" style={{ textTransform: 'uppercase' }}>
                          {row.name || 'Standard'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatNum(row.count)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'drivers' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Contact Phone</th>
                  <th>Completed Trips</th>
                  <th>Driver Rating</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No driver performance records found</td></tr>
                ) : (
                  paginatedTableData.map((driver, idx) => (
                    <tr key={driver._id || idx}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{driver.fullName || '—'}</td>
                      <td>{driver.phone || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatNum(driver.totalTrips)} trips</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#d97706' }}>
                          ★ {Number(driver.rating || 5.0).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'customers' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone Number</th>
                  <th>Email Address</th>
                  <th>Completed Bookings</th>
                  <th>Total Spent (INR)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No top customer records found</td></tr>
                ) : (
                  paginatedTableData.map((c, idx) => (
                    <tr key={c._id || idx}>
                      <td style={{ fontWeight: 600 }}>{c.customerObj?.name || 'Customer'}</td>
                      <td>{c.customerObj?.phone || '—'}</td>
                      <td>{c.customerObj?.email || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatNum(c.count)} bookings</td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatINR(c.totalPaid)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'vehicles' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Classification Group</th>
                  <th>Vehicle / Body Type</th>
                  <th>Units In Fleet</th>
                  <th>Fleet Share</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No vehicle fleet records found</td></tr>
                ) : (
                  paginatedTableData.map((v, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{v.category}</td>
                      <td>
                        <span className="status-pill status-in-progress" style={{ textTransform: 'capitalize' }}>
                          {String(v.name || 'Standard').replace(/-/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatNum(v.count)} units</td>
                      <td style={{ color: '#64748b' }}>
                        {dashboard?.totalVehicles ? `${((v.count / dashboard.totalVehicles) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'complaints' && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Raised By</th>
                  <th>Status</th>
                  <th>Date Filed</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTableData.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No recent complaints found</td></tr>
                ) : (
                  paginatedTableData.map((comp, idx) => (
                    <tr key={comp._id || idx}>
                      <td style={{ fontWeight: 600, maxWidth: 300 }}>{comp.subject || 'Complaint'}</td>
                      <td>{comp.raisedBy?.name || comp.raisedBy?.email || 'Customer'}</td>
                      <td>
                        <span className={`status-pill status-${comp.status || 'open'}`}>
                          {comp.status || 'open'}
                        </span>
                      </td>
                      <td>{formatDate(comp.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        <div className="table-pagination-footer">
          <div>
            Page <span className="page-indicator">{page}</span> of <span className="page-indicator">{totalPages}</span>
          </div>
          <div className="pagination-buttons">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
