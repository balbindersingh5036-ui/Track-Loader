import os
import textwrap

files = {}

files["src/main.jsx"] = """
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Provider } from 'react-redux';
import { store } from './store/store';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
"""

files["src/App.jsx"] = """
import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import AppRoutes from './routes/AppRoutes';
import { restoreSession } from './store/slices/authSlice';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
"""

files["src/styles/index.css"] = """
:root {
  --bg-color: #f5f7fb;
  --sidebar-bg: #0f1b2d;
  --primary: #1677ff;
  --primary-hover: #0958d9;
  --success: #52c41a;
  --warning: #faad14;
  --danger: #ff4d4f;
  --card-bg: #ffffff;
  --border-color: #f0f0f0;
  --text-primary: #1f1f1f;
  --text-secondary: #8c8c8c;
  --sidebar-text: #a6adb4;
  --sidebar-active: #1677ff;
  --sidebar-active-bg: rgba(22, 119, 255, 0.1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
  background-color: var(--bg-color);
  color: var(--text-primary);
  font-size: 14px;
}

/* Layout */
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 250px;
  background-color: var(--sidebar-bg);
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  font-size: 20px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  color: #fff;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  color: var(--sidebar-text);
  text-decoration: none;
  transition: all 0.2s;
  gap: 12px;
}

.nav-item:hover, .nav-item.active {
  color: #fff;
  background-color: var(--sidebar-active-bg);
}

.nav-item.active {
  border-right: 3px solid var(--primary);
}

.nav-item svg {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* Important for flex children to not overflow */
}

.header {
  height: 64px;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-color);
}

.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* Cards */
.card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--sidebar-active-bg);
  color: var(--primary);
}

.stat-info h4 {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: normal;
  margin-bottom: 4px;
}

.stat-info .value {
  font-size: 24px;
  font-weight: 600;
}

/* Tables */
.table-container {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}
th {
  background: #fafafa;
  font-weight: 500;
  color: var(--text-secondary);
}
tr:hover {
  background: #fafafa;
}

/* Forms & Inputs */
input, select, textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--primary);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
}
.btn-primary:hover {
  background-color: var(--primary-hover);
}

.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
}
.login-box {
  width: 400px;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.login-box h2 {
  text-align: center;
  margin-bottom: 24px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.badge.success { background: #f6ffed; color: var(--success); border: 1px solid #b7eb8f; }
.badge.warning { background: #fffbe6; color: var(--warning); border: 1px solid #ffe58f; }
.badge.danger { background: #fff2f0; color: var(--danger); border: 1px solid #ffccc7; }
.badge.default { background: #f5f5f5; color: var(--text-secondary); border: 1px solid #d9d9d9; }
"""

files["src/routes/AppRoutes.jsx"] = """
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
  const { token, user } = useSelector(state => state.auth);
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
"""

files["src/store/slices/authSlice.js"] = """
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/admin/login', credentials);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      return response.data.data;
    } catch (error) {
      return rejectWithValue('Failed to fetch profile');
    }
  }
);

const initialState = {
  user: null,
  token: localStorage.getItem('adminToken') || null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('adminToken');
    },
    restoreSession: (state) => {
      // Intentionally light restore session sync step
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem('adminToken', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logout, restoreSession } = authSlice.actions;
export default authSlice.reducer;
"""

files["src/store/store.js"] = """
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
"""

files["src/services/api.js"] = """
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Adjust if backend is on a different port
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
"""

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + "\\n")

print("Stage 1 complete.")
