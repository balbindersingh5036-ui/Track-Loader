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
  Image
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

const { width } = Dimensions.get('window');

const tabs = [
  { id: 'Home', icon: '🏠', label: 'Home' },
  { id: 'Requests', icon: '📋', label: 'Requests' },
  { id: 'Trips', icon: '🚚', label: 'Trips' },
  { id: 'Earnings', icon: '💰', label: 'Earnings' },
  { id: 'Profile', icon: '👤', label: 'Profile' }
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
  card2: '#182A3D'
};

const messageFor = (error) => {
  if (!error?.response) return 'Unable to connect to the service. Check your network and try again.';
  return error.response.data?.message || error.message || 'The request could not be completed.';
};

function ActionButton({ label, onPress, secondary = false, disabled = false, danger = false, style }) {
  const bgColor = danger ? colors.danger : (secondary ? colors.surface : colors.primary);
  const borderColor = danger ? colors.danger : (secondary ? colors.border : colors.primary);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        opacity: disabled ? 0.55 : 1,
        alignItems: 'center',
        justifyContent: 'center'
      }, style]}
    >
      <Text style={{ color: secondary ? colors.muted : '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{label}</Text>
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
        <Text style={{ color: colors.muted }}>Use the phone number registered with your driver account.</Text>
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
        <ActionButton label={loading ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={loading || !phone || !password} />
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
  const [lastEvent, setLastEvent] = useState('');

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
      setLastEvent(event);
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

  const markRead = async (id) => {
    setError('');
    try {
      await notificationService.markAsRead(id);
      setRefreshKey((key) => key + 1);
    } catch (notificationError) {
      setError(messageFor(notificationError));
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* HEADER */}
      <View style={{ backgroundColor: colors.surface, padding: 16, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <LoadBalbinLogo width={130} height={35} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: driver?.isOnline ? colors.green : colors.muted }} />
            <Text style={{ color: driver?.isOnline ? colors.green : colors.muted, fontWeight: 'bold', fontSize: 13 }}>{driver?.isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <Pressable style={{ padding: 4 }}>
             <Text style={{ fontSize: 20 }}>🔔</Text>
          </Pressable>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text> : null}
        {notice ? <Text style={{ color: colors.teal, fontWeight: '600' }}>{notice}</Text> : null}
        {loading && !refreshing ? <ActivityIndicator color={colors.primary} /> : null}

        {activeTab === 'Home' && (
          <>
            <BannerCarousel audience="driver" />
            
            {/* HERO */}
            <ImageBackground 
              source={{ uri: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=1000' }}
              style={{ width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' }}
            >
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,17,31,0.6)' }} />
              <View style={{ padding: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>Ready for your next trip?</Text>
                <Text style={{ color: colors.secondary || '#B8C4D1', fontSize: 14 }}>Accept loads. Deliver safely. Earn more.</Text>
              </View>
            </ImageBackground>

            <Text style={sectionTitle}>Stats Overview</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[cardStyle, { flex: 1, alignItems: 'center' }]}>
                <Text style={mutedText}>Today's Earnings</Text>
                <Text style={{ color: colors.teal, fontSize: 24, fontWeight: '800', marginTop: 8 }}>
                  ₹{earningsSummary?.currentPeriodEarnings || 0}
                </Text>
              </View>
              <View style={[cardStyle, { flex: 1, alignItems: 'center' }]}>
                <Text style={mutedText}>Completed Trips</Text>
                <Text style={{ color: colors.primary, fontSize: 24, fontWeight: '800', marginTop: 8 }}>
                  {earningsSummary?.completedTrips || 0}
                </Text>
              </View>
            </View>

            <View style={[cardStyle, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
                Currently {driver?.isOnline ? 'Online' : 'Offline'}
              </Text>
              <ActionButton 
                style={{ width: '100%' }}
                label={driver?.isOnline ? 'Go Offline' : 'Go Online'} 
                danger={driver?.isOnline}
                onPress={toggleOnline} 
              />
            </View>

            {requests.length > 0 && (
              <>
                <Text style={[sectionTitle, { marginTop: 8 }]}>New Requests</Text>
                {requests.slice(0, 3).map((booking) => (
                  <BookingCard key={booking._id} booking={booking} onAction={runAction} actions={['accept', 'reject']} />
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'Requests' && (
          <>
            <Text style={sectionTitle}>Available Requests</Text>
            {!loading && requests.length === 0 ? <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}><Text style={mutedText}>No available requests.</Text></View> : null}
            {requests.map((booking) => (
              <BookingCard key={booking._id} booking={booking} onAction={runAction} actions={['accept', 'reject']} />
            ))}
          </>
        )}

        {activeTab === 'Trips' && (
          <>
            <Text style={sectionTitle}>Active Trip & History</Text>
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
            <Text style={sectionTitle}>Earnings Summary</Text>
            {earningsSummary ? (
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 }}>
                   <Text style={mutedText}>Completed trips:</Text>
                   <Text style={bodyText}>{earningsSummary.completedTrips ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 12, marginBottom: 12 }}>
                   <Text style={mutedText}>Total earnings:</Text>
                   <Text style={bodyText}>₹{earningsSummary.totalEarnings ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                   <Text style={mutedText}>This period:</Text>
                   <Text style={[bodyText, { color: colors.teal }]}>₹{earningsSummary.currentPeriodEarnings ?? 0}</Text>
                </View>
              </View>
            ) : !loading ? <Text style={mutedText}>No earnings data available.</Text> : null}
            <Text style={[sectionTitle, { marginTop: 12 }]}>Completed Trips</Text>
            {earnings.length === 0 && !loading && <Text style={mutedText}>No history.</Text>}
            {earnings.map((item) => (
              <View key={item._id || item.bookingId} style={[cardStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={bodyText}>{item.bookingId}</Text>
                  <Text style={mutedText}>{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '—'}</Text>
                </View>
                <Text style={[bodyText, { color: colors.primary, fontSize: 18 }]}>₹{item.finalFare ?? item.estimatedFare ?? 0}</Text>
              </View>
            ))}
          </>
        )}

        {activeTab === 'Profile' && (
          <>
            <Text style={sectionTitle}>Profile & Support</Text>
            {profile ? (
              <View style={cardStyle}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>👤</Text>
                  </View>
                  <View>
                    <Text style={[bodyText, { fontSize: 18 }]}>{profile.fullName || profile.user?.name || user.name || 'Driver'}</Text>
                    <Text style={mutedText}>{profile.phone || profile.user?.phone || user.phone}</Text>
                  </View>
                </View>
                <Text style={mutedText}>Email: <Text style={bodyText}>{profile.email || profile.user?.email || user.email || '—'}</Text></Text>
                <Text style={mutedText}>Status: <Text style={[bodyText, { color: colors.teal, textTransform: 'capitalize' }]}>{profile.approvalStatus}</Text></Text>
                
                <Text style={[sectionTitle, { marginTop: 24, fontSize: 16 }]}>Vehicle & KYC</Text>
                {(!profile.vehicles || profile.vehicles.length === 0) && <Text style={mutedText}>No vehicles registered.</Text>}
                {(profile.vehicles || []).map((item) => (
                  <View key={item._id} style={{ marginTop: 8, padding: 12, backgroundColor: colors.card2, borderRadius: 10 }}>
                    <Text style={[bodyText, { fontSize: 16 }]}>{item.vehicleNumber}</Text>
                    <Text style={mutedText}>{item.vehicleModel} · {item.vehicleType}</Text>
                  </View>
                ))}
              </View>
            ) : !loading ? <Text style={mutedText}>Driver profile unavailable.</Text> : null}
            
            <View style={cardStyle}>
              <Text style={bodyText}>Customer Support</Text>
              <Text style={mutedText}>help@loadbalbin.com</Text>
            </View>
            <ActionButton label="Sign out" secondary onPress={logout} />
          </>
        )}
        {lastEvent ? <Text style={[mutedText, { fontSize: 11, textAlign: 'center' }]}>Latest update: {lastEvent}</Text> : null}
      </ScrollView>

      {/* BOTTOM NAVIGATION */}
      <View style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: colors.surface, 
        borderTopWidth: 1, 
        borderColor: colors.border, 
        flexDirection: 'row', 
        paddingBottom: Platform.OS === 'ios' ? 20 : 0 
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable 
              key={tab.id} 
              onPress={() => { setActiveTab(tab.id); setError(''); }} 
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22, color: isActive ? colors.primary : colors.muted, marginBottom: 4 }}>
                {tab.icon}
              </Text>
              <Text style={{ color: isActive ? colors.primary : colors.muted, fontWeight: '700', fontSize: 11 }}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function BookingCard({ booking, actions, onAction }) {
  const customer = booking.customer;
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[bodyText, { fontSize: 16 }]}>{booking.bookingId || 'Booking request'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: booking.bookingStatus === 'pending' ? colors.accent : colors.teal }} />
          <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }}>{booking.bookingStatus}</Text>
        </View>
      </View>
      
      <View style={{ backgroundColor: colors.card2, padding: 12, borderRadius: 10, gap: 10, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 16 }}>🟢</Text>
          <View style={{ flex: 1 }}>
            <Text style={mutedText} numberOfLines={2}><Text style={bodyText}>{booking.pickup?.address || '—'}</Text></Text>
          </View>
        </View>
        <View style={{ width: 2, height: 16, backgroundColor: colors.border, marginLeft: 9, marginTop: -8, marginBottom: -8 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 16 }}>🔴</Text>
          <View style={{ flex: 1 }}>
            <Text style={mutedText} numberOfLines={2}><Text style={bodyText}>{booking.drop?.address || '—'}</Text></Text>
          </View>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <View>
          <Text style={mutedText}>Goods / Load</Text>
          <Text style={bodyText}>{booking.goods} · {booking.weight?.value} {booking.weight?.unit}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={mutedText}>Est. Fare</Text>
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>₹{booking.estimatedFare ?? 0}</Text>
        </View>
      </View>
      
      {customer?.phone ? <Text style={mutedText}>Customer: {customer.name || 'Unknown'} · {customer.phone}</Text> : null}
      
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {actions.map((action) => {
            const isReject = action === 'reject';
            const label = action === 'accept' ? 'Accept Load' : action === 'start' ? 'Start Trip' : action === 'complete' ? 'Complete Trip' : 'Reject';
            return (
              <View key={action} style={{ flex: 1 }}>
                <ActionButton
                  label={label}
                  secondary={isReject}
                  style={!isReject ? { backgroundColor: colors.accent, borderColor: colors.accent } : {}}
                  onPress={() => onAction(action, booking)}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const cardStyle = { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 };
const sectionTitle = { color: colors.ink, fontSize: 18, fontWeight: '800' };
const bodyText = { color: colors.ink, fontWeight: '700' };
const mutedText = { color: colors.muted };
