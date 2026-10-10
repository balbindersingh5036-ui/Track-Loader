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
  ImageBackground,
  Dimensions,
  Platform,
  Image,
  StyleSheet
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await onLogin({ phone: phone.trim(), password });
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
        <Text style={{ color: colors.muted, fontSize: 13 }}>Use the phone number registered with your driver account.</Text>
        <TextInput
          accessibilityLabel="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={inputStyle}
        />
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        <ActionButton label={loading ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={loading || !phone || !password} style={{ backgroundColor: colors.primary, borderColor: colors.primary }} />
        {initialError && onRetry ? <ActionButton label="Retry previous session" secondary onPress={onRetry} disabled={loading} /> : null}
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
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
        const response = await bookingService.getRequests({ page: 1, limit: 30 });
        setRequests(response.data?.data?.bookings || []);
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
  }, [activeTab, refreshKey, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return undefined;
    }
    const socket = connectSocket(token);
    const unsubscribe = subscribeToSocketEvents((event, payload) => {
      if (event === 'socket:error') setError('Realtime connection is unavailable. Pull to refresh for updates.');
      if (payload?.bookingId || event === 'notification:new') setRefreshKey((key) => key + 1);
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [token]);

  useEffect(() => {
    if (activeTab !== 'Trips' || !trips.length) return;
    trips
      .filter((booking) => booking.bookingStatus === 'accepted' || booking.bookingStatus === 'in-progress')
      .forEach((booking) => joinBookingRoom(booking._id));
  }, [activeTab, trips]);

  const runAction = async (action, booking) => {
    setError('');
    setNotice('');
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
    }
  };

  const toggleOnline = async () => {
    setError('');
    try {
      const response = await driverService.updateStatus(!driver?.isOnline);
      setDriver((current) => ({ ...current, isOnline: response.data?.data?.isOnline }));
    } catch (statusError) {
      setError(messageFor(statusError));
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  };

  if (!ready) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;
  }
  if (!user) return <Login onLogin={signIn} onRetry={restoreSession} initialError={error} />;

  const driverNameDisplay = (driver?.fullName || user?.name || "DRIVER").toUpperCase();

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
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
          </View>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text> : null}
        {notice ? <Text style={{ color: colors.teal, fontWeight: '600' }}>{notice}</Text> : null}
        {loading && !refreshing ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}

        {activeTab === 'Home' && (
          <>
            <BannerCarousel 
              audience="driver" 
              fallback={
                /* HERO (MATCHING FIGMA) */
                <ImageBackground 
                  source={{ uri: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&q=80&w=1000' }}
                  style={{ width: '100%', height: 200, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-start', marginTop: 4 }}
                >
                  <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,17,31,0.75)' }} />
                  <View style={{ padding: 24, paddingTop: 32 }}>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
                      GOOD MORNING, {driverNameDisplay}
                    </Text>
                    <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800', marginBottom: 6, lineHeight: 32 }}>Ready for your{"\n"}next trip?</Text>
                    <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>Accept loads. Deliver safely. Earn more.</Text>
                  </View>
                </ImageBackground>
              }
            />

            {/* STATS (MATCHING FIGMA) */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[cardStyle, { flex: 1, paddingVertical: 18 }]}>
                <Text style={[labelStyle, { textTransform: 'none', fontSize: 11 }]}>Today's earnings</Text>
                <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
                  ₹{earningsSummary?.currentPeriodEarnings || 0}
                </Text>
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600' }}>↗ 18% this week</Text>
              </View>
              <View style={[cardStyle, { flex: 1, paddingVertical: 18 }]}>
                <Text style={[labelStyle, { textTransform: 'none', fontSize: 11 }]}>Completed</Text>
                <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
                  {(earningsSummary?.completedTrips || 0).toString().padStart(2, '0')}
                </Text>
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600' }}>1 trip active</Text>
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
                  <BookingCard key={booking._id} booking={booking} onAction={runAction} actions={['accept', 'reject']} />
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
            {!loading && requests.length === 0 ? <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}><Text style={mutedText}>No available requests.</Text></View> : null}
            {requests.map((booking) => (
              <BookingCard key={booking._id} booking={booking} onAction={runAction} actions={['accept', 'reject']} />
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
            {!loading && trips.length === 0 ? <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}><Text style={mutedText}>No active trips.</Text></View> : null}
            {trips.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                onAction={runAction}
                actions={booking.bookingStatus === 'accepted' ? ['start'] : booking.bookingStatus === 'in-progress' ? ['complete'] : []}
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
                   <Text style={[labelStyle, { textTransform: 'none' }]}>This period</Text>
                   <Text style={[bodyText, { color: colors.teal }]}>₹{earningsSummary.currentPeriodEarnings ?? 0}</Text>
                </View>
              </View>
            ) : !loading ? <Text style={mutedText}>No earnings data available.</Text> : null}
            <Text style={[sectionTitle, { marginTop: 12 }]}>COMPLETED TRIPS</Text>
            {earnings.length === 0 && !loading && <Text style={mutedText}>No history.</Text>}
            {earnings.map((item) => (
              <View key={item._id || item.bookingId} style={[cardStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={bodyText}>{item.bookingId}</Text>
                  <Text style={mutedText}>{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '—'}</Text>
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
            
            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                Currently {driver?.isOnline ? 'Online' : 'Offline'}
              </Text>
              <ActionButton 
                style={{ width: '100%', backgroundColor: driver?.isOnline ? 'transparent' : colors.primary, borderColor: driver?.isOnline ? colors.border : colors.primary }}
                label={driver?.isOnline ? 'Go Offline' : 'Go Online'} 
                secondary={driver?.isOnline}
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
                <Text style={[labelStyle, { marginTop: 8, textTransform: 'none' }]}>Status: <Text style={[bodyText, { color: colors.teal, textTransform: 'capitalize' }]}>{profile.approvalStatus}</Text></Text>
                
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 4 }}>VEHICLE & KYC</Text>
                {(!profile.vehicles || profile.vehicles.length === 0) && <Text style={mutedText}>No vehicles registered.</Text>}
                {(profile.vehicles || []).map((item) => (
                  <View key={item._id} style={{ marginTop: 8, padding: 16, backgroundColor: colors.card2, borderRadius: 12 }}>
                    <Text style={[bodyText, { fontSize: 16, marginBottom: 4 }]}>{item.vehicleNumber}</Text>
                    <Text style={mutedText}>{item.vehicleModel} · {item.vehicleType}</Text>
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
              onPress={() => { setActiveTab(tab.id); setError(''); }} 
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

function BookingCard({ booking, actions, onAction }) {
  return (
    <View style={cardStyle}>
      {/* HEADER ROW */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[bodyText, { fontSize: 14, color: colors.teal, fontWeight: '700' }]}>#{booking.bookingId || 'LR-REQUEST'}</Text>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '800' }}>₹{booking.estimatedFare ?? 0}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600' }}>2 min ago</Text>
      </View>
      
      {/* LOCATIONS */}
      <View style={{ gap: 4, marginTop: 16 }}>
        <Text style={bodyText} numberOfLines={1}>{booking.pickup?.address || '—'}</Text>
        <View style={{ width: 1, height: 12, backgroundColor: colors.border, marginLeft: 0, marginTop: 2, marginBottom: 2 }} />
        <Text style={bodyText} numberOfLines={1}>{booking.drop?.address || '—'}</Text>
      </View>
      
      <Text style={[mutedText, { fontSize: 12, marginTop: 16 }]}>{booking.distance || '18.6 km'} · {booking.goods || 'Packaged goods'} · {booking.weight?.value || '1.2'} {booking.weight?.unit || 't'}</Text>

      {/* ACTIONS */}
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
          {actions.map((action) => {
            const isReject = action === 'reject';
            const label = action === 'accept' ? 'Accept load' : action === 'start' ? 'Start Trip' : action === 'complete' ? 'Complete Trip' : 'Reject';
            return (
              <View key={action} style={!isReject ? { flex: 2 } : { flex: 1 }}>
                <ActionButton
                  label={label}
                  secondary={isReject}
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
