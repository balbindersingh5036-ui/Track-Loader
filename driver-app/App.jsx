import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  Dimensions,
  Platform,
  Image,
  StyleSheet,
  Modal
} from 'react-native';
import api, { setAuthenticationExpiredHandler } from './src/services/api';
import authService from './src/services/authService';
import bookingService from './src/services/bookingService';
import driverService from './src/services/driverService';
import earningsService from './src/services/earningsService';
import notificationService from './src/services/notificationService';
import { connectSocket, disconnectSocket, joinBookingRoom, subscribeToSocketEvents } from './src/services/socketService';
import { getToken, removeToken, saveToken } from './src/utils/authStorage';
import LoadBalbinLogo from './src/components/LoadBalbinLogo';
import BannerCarousel from './src/components/BannerCarousel';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const tabs = [
  { id: 'Home', icon: 'home-outline', activeIcon: 'home', label: 'Home', family: 'Ionicons' },
  { id: 'Requests', icon: 'cube-outline', activeIcon: 'cube', label: 'Requests', family: 'Ionicons' },
  { id: 'Trips', icon: 'truck-outline', activeIcon: 'truck', label: 'Trips', family: 'MaterialCommunityIcons' },
  { id: 'Earnings', icon: 'wallet-outline', activeIcon: 'wallet', label: 'Earnings', family: 'Ionicons' },
  { id: 'Profile', icon: 'account-outline', activeIcon: 'account', label: 'Profile', family: 'MaterialCommunityIcons' }
];

const colors = { 
  ink: '#FFFFFF', 
  muted: '#8A98A8', 
  teal: '#14B8A6',
  green: '#22C55E', 
  border: '#25364A', 
  bg: '#08111F', 
  danger: '#EF4444',
  primary: '#08A9F5',
  accent: '#FF7A00',
  surface: '#0F1B29',
  card: '#142334',
  card2: '#182A3D',
  orange: '#E96800',
  warning: '#F59E0B'
};

const messageFor = (error) => {
  if (!error?.response) return 'Unable to connect to the service. Check your network and try again.';
  return error.response.data?.message || error.message || 'The request could not be completed.';
};

function ActionButton({ label, onPress, secondary = false, disabled = false, danger = false, style, textStyle }) {
  const bgColor = danger ? colors.danger : (secondary ? colors.surface : colors.accent);
  const borderColor = danger ? colors.danger : (secondary ? colors.border : colors.accent);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        opacity: disabled ? 0.55 : 1,
        alignItems: 'center',
        justifyContent: 'center'
      }, style]}
    >
      <Text style={[{ color: secondary ? colors.muted : '#FFFFFF', fontWeight: '800', fontSize: 14 }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function Login({ onLogin, onRetry, initialError }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');

  const submit = async () => {
    if (loading) return;
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your registered phone number or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onLogin({ identifier: cleanId, password });
    } catch (loginError) {
      setError(messageFor(loginError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 16, gap: 16, borderColor: colors.border, borderWidth: 1 }}>
        <LoadBalbinLogo width={180} height={50} style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Driver sign in</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Use the phone number or email registered with your driver account.</Text>
        
        <TextInput
          accessibilityLabel="Phone number or email"
          value={identifier}
          onChangeText={(val) => { setIdentifier(val); setError(''); }}
          placeholder="Phone number or email"
          placeholderTextColor={colors.muted}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <TextInput
            accessibilityLabel="Password"
            value={password}
            onChangeText={(val) => { setPassword(val); setError(''); }}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={[inputStyle, { paddingRight: 48 }]}
          />
          <Pressable
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: 14, height: 40, justifyContent: 'center' }}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
          </Pressable>
        </View>

        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        
        <ActionButton 
          label={loading ? 'Signing in…' : 'Sign in'} 
          onPress={submit} 
          disabled={loading || !identifier.trim() || !password} 
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }} 
        />
        
        {initialError && onRetry ? (
          <ActionButton label="Retry previous session" secondary onPress={onRetry} disabled={loading} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const inputStyle = {
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 10,
  padding: 14,
  color: colors.ink,
  backgroundColor: colors.card,
  fontSize: 16
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [driver, setDriver] = useState(null);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [trips, setTrips] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const logout = useCallback(async () => {
    disconnectSocket();
    await removeToken();
    setToken(null);
    setUser(null);
    setDriver(null);
    setProfile(null);
    setRequests([]);
    setTrips([]);
    setEarnings([]);
    setEarningsSummary(null);
    setNotifications([]);
    setUnreadCount(0);
    setError('');
    setNotice('');
  }, []);

  const establish = useCallback(async (newToken) => {
    await saveToken(newToken);
    const response = await authService.getMe();
    const currentUser = response.data?.data?.user;
    if (currentUser?.role !== 'driver') {
      await removeToken();
      throw new Error('This account is not authorized for the driver application.');
    }
    setToken(newToken);
    setUser(currentUser);
    setError('');
  }, []);

  const restoreSession = useCallback(async () => {
    setReady(false);
    setError('');
    try {
      const storedToken = await getToken();
      if (storedToken) await establish(storedToken);
    } catch (restoreError) {
      if (restoreError?.response?.status === 401) await removeToken();
      else setError(messageFor(restoreError));
    } finally {
      setReady(true);
    }
  }, [establish]);

  useEffect(() => {
    setAuthenticationExpiredHandler(() => {
      disconnectSocket();
      setToken(null);
      setUser(null);
      setError('Your session expired. Please sign in again.');
    });
    restoreSession();
    return () => setAuthenticationExpiredHandler(undefined);
  }, [restoreSession]);

  const signIn = async (credentials) => {
    const response = await authService.login(credentials);
    const newToken = response.data?.data?.token;
    if (!newToken) throw new Error('The sign-in response did not include a session token.');
    await establish(newToken);
  };

  const fetchUnreadNotificationsCount = useCallback(async () => {
    try {
      const countRes = await notificationService.getUnreadCount();
      if (typeof countRes.data?.data?.count === 'number') {
        setUnreadCount(countRes.data.data.count);
      }
    } catch (e) {
      // Non-blocking
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      fetchUnreadNotificationsCount();

      if (activeTab === 'Home') {
        const [sumResponse, reqResponse, driverResp] = await Promise.all([
          earningsService.getSummary().catch(() => ({ data: { data: null } })),
          bookingService.getRequests({ page: 1, limit: 10 }).catch(() => ({ data: { data: { bookings: [] } } })),
          driverService.getProfile().catch(() => ({ data: { data: { driver: null } } }))
        ]);
        setEarningsSummary(sumResponse.data?.data || null);
        setRequests(reqResponse.data?.data?.bookings || []);
        if (driverResp.data?.data?.driver) {
          setDriver(driverResp.data.data.driver);
        }
      } else if (activeTab === 'Requests') {
        const [reqResponse, driverResp] = await Promise.all([
          bookingService.getRequests({ page: 1, limit: 30 }),
          driverService.getProfile().catch(() => ({ data: { data: { driver: null } } }))
        ]);
        setRequests(reqResponse.data?.data?.bookings || []);
        if (driverResp.data?.data?.driver) {
          setDriver(driverResp.data.data.driver);
        }
      } else if (activeTab === 'Trips') {
        const response = await bookingService.getMyBookings({ page: 1, limit: 30 });
        setTrips(response.data?.data?.bookings || []);
      } else if (activeTab === 'Earnings') {
        const [summary, list] = await Promise.all([
          earningsService.getSummary().catch(() => ({ data: { data: null } })),
          earningsService.getEarnings({ page: 1, limit: 30 }).catch(() => ({ data: { data: { earnings: [] } } }))
        ]);
        setEarningsSummary(summary.data?.data || null);
        setEarnings(list.data?.data?.earnings || []);
      } else if (activeTab === 'Profile') {
        const [driverResponse, vehicleResponse] = await Promise.all([
          driverService.getProfile().catch(() => ({ data: { data: null } })),
          driverService.getVehicles().catch(() => ({ data: { data: null } }))
        ]);
        const driverProfile = driverResponse.data?.data?.driver || null;
        setDriver(driverProfile);
        setProfile(driverProfile
          ? { ...driverProfile, vehicles: vehicleResponse.data?.data?.vehicles || [] }
          : null);
      }
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, refreshKey, user, fetchUnreadNotificationsCount]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return undefined;
    }
    const socket = connectSocket(token);
    const unsubscribe = subscribeToSocketEvents((event, payload) => {
      if (event === 'socket:error') setError('Realtime connection is unavailable. Pull to refresh for updates.');
      if (payload?.bookingId || event === 'notification:new') {
        setRefreshKey((key) => key + 1);
        fetchUnreadNotificationsCount();
      }
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [token, fetchUnreadNotificationsCount]);

  useEffect(() => {
    if (activeTab !== 'Trips' || !trips.length) return;
    trips
      .filter((booking) => booking.bookingStatus === 'accepted' || booking.bookingStatus === 'in-progress')
      .forEach((booking) => joinBookingRoom(booking._id));
  }, [activeTab, trips]);

  const runAction = async (action, booking) => {
    if (actionLoadingId) return;
    setError('');
    setNotice('');
    setActionLoadingId(booking._id);
    try {
      const id = booking._id;
      if (action === 'accept') await bookingService.acceptBooking(id);
      if (action === 'reject') await bookingService.rejectBooking(id, 'Driver declined the request.');
      if (action === 'start') await bookingService.startTrip(id);
      if (action === 'complete') await bookingService.completeTrip(id);
      if (action === 'accept') joinBookingRoom(id);
      setNotice(`Booking ${action === 'start' ? 'trip started' : action === 'complete' ? 'completed' : `${action}ed`}.`);
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      setError(messageFor(actionError));
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleOnline = async () => {
    if (onlineLoading) return;
    setError('');
    setNotice('');
    const nextState = !driver?.isOnline;
    setOnlineLoading(true);
    try {
      const response = await driverService.updateStatus(nextState);
      setDriver((current) => ({ ...current, isOnline: response.data?.data?.isOnline }));
      setNotice(`You are now ${response.data?.data?.isOnline ? 'Online' : 'Offline'}.`);
    } catch (statusError) {
      setError(messageFor(statusError));
    } finally {
      setOnlineLoading(false);
    }
  };

  const openNotifications = async () => {
    setShowNotificationsModal(true);
    try {
      const res = await notificationService.getNotifications({ page: 1, limit: 30 });
      setNotifications(res.data?.data?.notifications || []);
      await notificationService.markAllAsRead();
      setUnreadCount(0);
    } catch (err) {
      // Non-blocking
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }
  
  if (!user) {
    return <Login onLogin={signIn} onRetry={restoreSession} initialError={error} />;
  }

  const driverNameDisplay = (driver?.fullName || user?.name || "DRIVER").toUpperCase();
  const hasVehicle = profile?.vehicles && profile.vehicles.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* HEADER (MATCHING FIGMA) */}
      <View style={{ backgroundColor: colors.bg, paddingLeft: 0, paddingRight: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <LoadBalbinLogo style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: driver?.isOnline ? colors.green : colors.muted }} />
            <Text style={{ color: driver?.isOnline ? colors.green : colors.muted, fontWeight: '700', fontSize: 10 }}>{driver?.isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
          <Pressable 
            accessibilityLabel="Notifications"
            onPress={openNotifications}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: colors.accent, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: '600', padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 }}>{error}</Text> : null}
        {notice ? <Text style={{ color: colors.teal, fontWeight: '600', padding: 8, backgroundColor: 'rgba(20, 184, 166, 0.1)', borderRadius: 8 }}>{notice}</Text> : null}
        {loading && !refreshing ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}

        {activeTab === 'Home' && (
          <>
            <BannerCarousel audience="driver" />

            {/* DRIVER WELCOME & VERIFICATION STATUS CARD */}
            <View style={[cardStyle, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }]}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="person" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[bodyText, { fontSize: 16 }]}>{driverNameDisplay}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: driver?.approvalStatus === 'approved' ? colors.green : driver?.approvalStatus === 'rejected' ? colors.danger : colors.warning
                  }} />
                  <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'capitalize' }}>
                    Status: <Text style={{ color: colors.ink, fontWeight: '700' }}>{driver?.approvalStatus || 'pending'}</Text>
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Toggle online state"
                onPress={toggleOnline}
                disabled={driver?.approvalStatus !== 'approved' || onlineLoading}
                style={{
                  backgroundColor: driver?.isOnline ? colors.green : colors.surface,
                  borderColor: driver?.isOnline ? colors.green : colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  opacity: driver?.approvalStatus !== 'approved' ? 0.5 : 1
                }}
              >
                <Text style={{ color: driver?.isOnline ? '#000000' : colors.muted, fontWeight: '800', fontSize: 11 }}>
                  {onlineLoading ? '...' : (driver?.isOnline ? 'ONLINE' : 'GO ONLINE')}
                </Text>
              </Pressable>
            </View>

            {/* STATS (MATCHING FIGMA) */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[cardStyle, { flex: 1, paddingVertical: 18 }]}>
                <Text style={[labelStyle, { textTransform: 'none', fontSize: 11 }]}>Total earnings</Text>
                <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
                  ₹{earningsSummary?.totalEarnings || 0}
                </Text>
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600' }}>₹{earningsSummary?.currentPeriodEarnings || 0} this month</Text>
              </View>
              <View style={[cardStyle, { flex: 1, paddingVertical: 18 }]}>
                <Text style={[labelStyle, { textTransform: 'none', fontSize: 11 }]}>Completed trips</Text>
                <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
                  {(earningsSummary?.completedTrips || 0).toString().padStart(2, '0')}
                </Text>
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600' }}>Rating: {driver?.rating ? `${driver.rating} ★` : '5.0 ★'}</Text>
              </View>
            </View>

            {requests.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, marginBottom: 8 }}>
                  <View>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                      NEW REQUESTS
                    </Text>
                    <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Loads near you</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                    <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 11 }}>{requests.length} new</Text>
                  </View>
                </View>
                {requests.slice(0, 3).map((booking) => (
                  <BookingCard 
                    key={booking._id} 
                    booking={booking} 
                    onAction={runAction} 
                    actions={['accept', 'reject']} 
                    actionLoading={actionLoadingId === booking._id}
                  />
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'Requests' && (
          <>
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                AVAILABLE REQUESTS
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Loads near you</Text>
            </View>

            {driver?.approvalStatus !== 'approved' && (
              <View style={[cardStyle, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: colors.warning, borderWidth: 1, padding: 14 }]}>
                <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '700' }}>
                  Account Pending Approval
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  New load requests will become visible once your account is verified by the administrator.
                </Text>
              </View>
            )}

            {!loading && requests.length === 0 ? (
              <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}>
                <Ionicons name="cube-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={bodyText}>No available requests.</Text>
                <Text style={[mutedText, { marginTop: 4, textAlign: 'center' }]}>
                  {driver?.isOnline ? 'Checking for new customer bookings in your vehicle category...' : 'Go online to receive real-time load requests.'}
                </Text>
              </View>
            ) : null}

            {requests.map((booking) => (
              <BookingCard 
                key={booking._id} 
                booking={booking} 
                onAction={runAction} 
                actions={['accept', 'reject']} 
                actionLoading={actionLoadingId === booking._id}
              />
            ))}
          </>
        )}

        {activeTab === 'Trips' && (
          <>
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                ACTIVE TRIP & HISTORY
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Your trips</Text>
            </View>

            {!loading && trips.length === 0 ? (
              <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}>
                <Ionicons name="truck-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={bodyText}>No active or completed trips.</Text>
                <Text style={[mutedText, { marginTop: 4 }]}>Accepted trips will appear here.</Text>
              </View>
            ) : null}

            {trips.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                onAction={runAction}
                actions={booking.bookingStatus === 'accepted' ? ['start'] : booking.bookingStatus === 'in-progress' ? ['complete'] : []}
                actionLoading={actionLoadingId === booking._id}
              />
            ))}
          </>
        )}

        {activeTab === 'Earnings' && (
          <>
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                EARNINGS SUMMARY
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Your revenue</Text>
            </View>

            {earningsSummary ? (
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
                   <Text style={[labelStyle, { textTransform: 'none' }]}>Completed trips</Text>
                   <Text style={bodyText}>{(earningsSummary.completedTrips ?? 0).toString().padStart(2, '0')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
                   <Text style={[labelStyle, { textTransform: 'none' }]}>Total earnings</Text>
                   <Text style={bodyText}>₹{earningsSummary.totalEarnings ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                   <Text style={[labelStyle, { textTransform: 'none' }]}>This month's period</Text>
                   <Text style={[bodyText, { color: colors.teal }]}>₹{earningsSummary.currentPeriodEarnings ?? 0}</Text>
                </View>
              </View>
            ) : !loading ? <Text style={mutedText}>No earnings data available.</Text> : null}

            <Text style={[sectionTitle, { marginTop: 12, marginBottom: 4 }]}>COMPLETED TRIPS HISTORY</Text>
            {earnings.length === 0 && !loading && (
              <View style={[cardStyle, { alignItems: 'center', padding: 24 }]}>
                <Text style={mutedText}>No trip history recorded yet.</Text>
              </View>
            )}

            {earnings.map((item) => (
              <View key={item._id || item.bookingId} style={[cardStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ gap: 4 }}>
                  <Text style={bodyText}>#{item.bookingId}</Text>
                  <Text style={mutedText}>{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '—'}</Text>
                  <Text style={[labelStyle, { fontSize: 11, textTransform: 'capitalize' }]}>{item.vehicleType || 'Truck'} · {item.paymentStatus || 'paid'}</Text>
                </View>
                <Text style={[bodyText, { color: colors.accent, fontSize: 18 }]}>₹{item.finalFare ?? item.estimatedFare ?? 0}</Text>
              </View>
            ))}
          </>
        )}

        {activeTab === 'Profile' && (
          <>
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                PROFILE & SUPPORT
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Your account</Text>
            </View>
            
            {/* VERIFICATION & AGENCY STATUS BANNER */}
            {driver?.approvalStatus !== 'approved' && (
              <View style={[cardStyle, {
                backgroundColor: driver?.approvalStatus === 'rejected' ? '#2A1215' : '#2A2412',
                borderColor: driver?.approvalStatus === 'rejected' ? colors.danger : colors.warning,
                borderWidth: 1,
                padding: 16
              }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Ionicons
                    name={driver?.approvalStatus === 'rejected' ? 'alert-circle' : 'time'}
                    size={22}
                    color={driver?.approvalStatus === 'rejected' ? colors.danger : colors.warning}
                  />
                  <Text style={{
                    color: driver?.approvalStatus === 'rejected' ? colors.danger : colors.warning,
                    fontSize: 16,
                    fontWeight: '800',
                    textTransform: 'uppercase'
                  }}>
                    Account {driver?.approvalStatus}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18 }}>
                  {driver?.approvalStatus === 'rejected'
                    ? 'Your driver application was rejected by Super Admin. Please contact your agency or support to re-upload documents.'
                    : 'Your driver account is pending Super Admin document verification. You cannot go online or accept booking requests until approved.'}
                </Text>
                {driver?.rejectionReason ? (
                  <View style={{ marginTop: 8, padding: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>
                      Rejection Reason: {driver.rejectionReason}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
                Currently {driver?.isOnline ? 'Online' : 'Offline'}
              </Text>
              {driver?.approvalStatus !== 'approved' ? (
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                  Going online is disabled until Super Admin approves your account.
                </Text>
              ) : null}
              <ActionButton 
                style={{
                  width: '100%',
                  backgroundColor: driver?.isOnline ? 'transparent' : (driver?.approvalStatus === 'approved' ? colors.primary : colors.surface),
                  borderColor: driver?.isOnline ? colors.border : (driver?.approvalStatus === 'approved' ? colors.primary : colors.border)
                }}
                disabled={driver?.approvalStatus !== 'approved' || onlineLoading}
                label={onlineLoading ? 'Updating…' : (driver?.isOnline ? 'Go Offline' : 'Go Online')} 
                secondary={driver?.isOnline || driver?.approvalStatus !== 'approved'}
                onPress={toggleOnline} 
              />
            </View>

            {profile ? (
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Ionicons name="person" size={24} color={colors.muted} />
                  </View>
                  <View>
                    <Text style={[bodyText, { fontSize: 18 }]}>{driverNameDisplay}</Text>
                    <Text style={mutedText}>{profile.phone || profile.user?.phone || user.phone}</Text>
                  </View>
                </View>
                <Text style={[labelStyle, { textTransform: 'none' }]}>Email: <Text style={bodyText}>{profile.email || profile.user?.email || user.email || '—'}</Text></Text>
                <Text style={[labelStyle, { marginTop: 8, textTransform: 'none' }]}>Approval Status: <Text style={[bodyText, {
                  color: profile.approvalStatus === 'approved' ? colors.green : profile.approvalStatus === 'rejected' ? colors.danger : colors.warning,
                  textTransform: 'capitalize',
                  fontWeight: '700'
                }]}>{profile.approvalStatus}</Text></Text>

                {/* Agency Affiliation Details */}
                {profile.agency ? (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: colors.card2, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 }}>
                      AFFILIATED FLEET AGENCY
                    </Text>
                    <Text style={[bodyText, { fontSize: 15, fontWeight: '700' }]}>{profile.agency.agencyName}</Text>
                    <Text style={mutedText}>Phone: {profile.agency.phone || '—'}</Text>
                    <Text style={mutedText}>Location: {profile.agency.city || profile.agency.address || '—'}</Text>
                    <Text style={[mutedText, { marginTop: 4, fontSize: 11 }]}>Agency Status: <Text style={{ color: profile.agency.approvalStatus === 'approved' ? colors.green : colors.warning, textTransform: 'capitalize' }}>{profile.agency.approvalStatus}</Text></Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 16, padding: 10, backgroundColor: colors.surface, borderRadius: 8 }}>
                    <Text style={[mutedText, { fontSize: 12 }]}>Independent Driver (No Agency Linked)</Text>
                  </View>
                )}
                
                {/* KYC & Identity Verification */}
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>
                  VERIFIED KYC DOCUMENTS
                </Text>
                <View style={{ gap: 8 }}>
                  {[
                    { label: 'Driving Licence', key: 'drivingLicense', doc: profile.documents?.drivingLicense },
                    { label: 'Identity Proof (Aadhaar)', key: 'idProof', doc: profile.documents?.idProof },
                    { label: 'Vehicle Registration (RC)', key: 'vehicleRegistration', doc: profile.documents?.vehicleRegistration },
                    { label: 'Insurance Policy', key: 'insurance', doc: profile.documents?.insurance }
                  ].map((item) => {
                    const status = item.doc?.status || (item.doc?.url ? 'submitted' : 'not_uploaded');
                    const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.danger : colors.warning;
                    return (
                      <View key={item.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.card2, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name="document-text-outline" size={18} color={colors.muted} />
                          <Text style={[bodyText, { fontSize: 13 }]}>{item.label}</Text>
                        </View>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                            {status.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Assigned Vehicle */}
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 4 }}>
                  ASSIGNED FLEET VEHICLE
                </Text>
                {(!profile.vehicles || profile.vehicles.length === 0) && (
                  <Text style={mutedText}>No vehicle assigned by agency yet.</Text>
                )}
                {(profile.vehicles || []).map((item) => (
                  <View key={item._id} style={{ marginTop: 8, padding: 16, backgroundColor: colors.card2, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[bodyText, { fontSize: 16, fontWeight: '700' }]}>{item.vehicleNumber}</Text>
                      <Text style={{ color: item.isAvailable ? colors.green : colors.orange, fontSize: 11, fontWeight: '700' }}>
                        {item.isAvailable ? 'AVAILABLE' : 'ON TRIP'}
                      </Text>
                    </View>
                    <Text style={[mutedText, { marginTop: 4 }]}>{item.vehicleModel} · {item.vehicleType}</Text>
                    <Text style={[mutedText, { fontSize: 12, marginTop: 2 }]}>Capacity: {item.loadCapacity?.value} {item.loadCapacity?.unit}</Text>
                  </View>
                ))}
              </View>
            ) : !loading ? <Text style={mutedText}>Driver profile unavailable.</Text> : null}
            
            <View style={cardStyle}>
              <Text style={bodyText}>Customer Support</Text>
              <Text style={mutedText}>help@loadbalbin.com</Text>
            </View>
            <ActionButton label="Sign out" secondary onPress={logout} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>

      {/* NOTIFICATIONS MODAL */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Notifications</Text>
            <Pressable 
              accessibilityLabel="Close notifications"
              onPress={() => setShowNotificationsModal(false)}
              style={{ padding: 6 }}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {notifications.length === 0 ? (
              <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}>
                <Ionicons name="notifications-off-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={bodyText}>No notifications</Text>
                <Text style={[mutedText, { marginTop: 4 }]}>You're all caught up!</Text>
              </View>
            ) : null}

            {notifications.map((item) => (
              <View key={item._id} style={[cardStyle, { padding: 16, borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
                <Text style={[bodyText, { fontSize: 15 }]}>{item.title}</Text>
                <Text style={[mutedText, { marginTop: 6, lineHeight: 18 }]}>{item.message}</Text>
                <Text style={[labelStyle, { fontSize: 10, marginTop: 10 }]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* BOTTOM NAVIGATION FIXED TO BOTTOM */}
      <View style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: colors.bg, 
        borderTopWidth: 1, 
        borderColor: colors.border, 
        flexDirection: 'row', 
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        paddingTop: 16
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable 
              key={tab.id} 
              onPress={() => { setActiveTab(tab.id); setError(''); setNotice(''); }} 
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {tab.family === 'MaterialCommunityIcons' ? (
                <MaterialCommunityIcons 
                  name={isActive ? tab.activeIcon : tab.icon} 
                  size={24} 
                  color={isActive ? colors.primary : colors.muted} 
                  style={{ marginBottom: 6 }} 
                />
              ) : (
                <Ionicons 
                  name={isActive ? tab.activeIcon : tab.icon} 
                  size={24} 
                  color={isActive ? colors.primary : colors.muted} 
                  style={{ marginBottom: 6 }} 
                />
              )}
              <Text style={{ color: isActive ? colors.primary : colors.muted, fontWeight: '700', fontSize: 10 }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function BookingCard({ booking, actions, onAction, actionLoading }) {
  const pickupDateFormatted = booking.preferredPickupDate 
    ? new Date(booking.preferredPickupDate).toLocaleDateString()
    : null;
  const isScheduled = booking.bookingMode === 'scheduled';

  return (
    <View style={cardStyle}>
      {/* HEADER ROW */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[bodyText, { fontSize: 14, color: colors.teal, fontWeight: '700' }]}>#{booking.bookingId || 'LR-REQUEST'}</Text>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '800' }}>₹{booking.finalFare || booking.estimatedFare || 0}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isScheduled && (
            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '700' }}>SCHEDULED</Text>
            </View>
          )}
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
            {booking.bookingStatus}
          </Text>
        </View>
      </View>

      {/* SCHEDULED TIME DETAILS */}
      {isScheduled && pickupDateFormatted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Ionicons name="calendar-outline" size={14} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600' }}>
            Pickup: {pickupDateFormatted} {booking.preferredPickupTime ? `at ${booking.preferredPickupTime}` : ''}
          </Text>
        </View>
      )}
      
      {/* LOCATIONS */}
      <View style={{ gap: 4, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 5 }} />
          <Text style={[bodyText, { flex: 1 }]} numberOfLines={2}>{booking.pickup?.address || 'Pickup location'}</Text>
        </View>
        <View style={{ width: 1, height: 10, backgroundColor: colors.border, marginLeft: 3 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 }} />
          <Text style={[bodyText, { flex: 1 }]} numberOfLines={2}>{booking.drop?.address || 'Drop location'}</Text>
        </View>
      </View>
      
      {/* SPECIFICATIONS */}
      <Text style={[mutedText, { fontSize: 12, marginTop: 14 }]}>
        {booking.vehicleType || 'Truck'} · {booking.goods || 'General Cargo'} · {booking.weight?.value || 0} {booking.weight?.unit || 'kg'}
        {booking.distanceKm ? ` · ${booking.distanceKm} km` : ''}
      </Text>

      {/* CUSTOMER NOTE */}
      {booking.customerNote ? (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.card2, borderRadius: 6 }}>
          <Text style={[mutedText, { fontSize: 11 }]}>Note: {booking.customerNote}</Text>
        </View>
      ) : null}

      {/* ACTIONS */}
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          {actions.map((action) => {
            const isReject = action === 'reject';
            const label = action === 'accept' ? 'Accept load' : action === 'start' ? 'Start Trip' : action === 'complete' ? 'Complete Trip' : 'Reject';
            return (
              <View key={action} style={!isReject ? { flex: 2 } : { flex: 1 }}>
                <ActionButton
                  label={actionLoading ? 'Processing…' : label}
                  secondary={isReject}
                  disabled={actionLoading}
                  onPress={() => onAction(action, booking)}
                  textStyle={!isReject ? { color: '#000000', fontWeight: '800' } : {}}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const cardStyle = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 20 };
const sectionTitle = { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' };
const bodyText = { color: colors.ink, fontWeight: '700', fontSize: 14 };
const labelStyle = { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' };
const mutedText = { color: colors.muted, fontSize: 13, fontWeight: '600' };
