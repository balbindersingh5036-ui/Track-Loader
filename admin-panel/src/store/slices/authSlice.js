import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/admin/login', credentials);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return { user: null, token: null };

    try {
      const response = await api.get('/auth/me');
      const user = response.data.data.user;
      if (!['admin', 'agency'].includes(user?.role)) {
        localStorage.removeItem('adminToken');
        return { user: null, token: null };
      }
      return { user, token };
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        localStorage.removeItem('adminToken');
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to restore admin session');
    }
  }
);

export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      return response.data.data.user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

const getStoredJson = (key) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const initialState = {
  user: getStoredJson('adminUser'),
  agency: getStoredJson('adminAgency'),
  token: localStorage.getItem('adminToken') || null,
  loading: false,
  restoring: !!localStorage.getItem('adminToken'),
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.agency = null;
      state.token = null;
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminAgency');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.restoring = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restoring = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        if (action.payload.user) {
          localStorage.setItem('adminUser', JSON.stringify(action.payload.user));
        }
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.restoring = false;
        state.error = action.payload;
        if (!localStorage.getItem('adminToken')) {
          state.user = null;
          state.agency = null;
          state.token = null;
          localStorage.removeItem('adminUser');
          localStorage.removeItem('adminAgency');
        }
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.restoring = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.agency = action.payload.agency || null;
        localStorage.setItem('adminToken', action.payload.token);
        if (action.payload.user) {
          localStorage.setItem('adminUser', JSON.stringify(action.payload.user));
        }
        if (action.payload.agency) {
          localStorage.setItem('adminAgency', JSON.stringify(action.payload.agency));
        } else {
          localStorage.removeItem('adminAgency');
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        if (action.payload) {
          localStorage.setItem('adminUser', JSON.stringify(action.payload));
        }
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;