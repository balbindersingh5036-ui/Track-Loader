import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import api, { setAuthenticationExpiredHandler } from './src/services/api';
import authService from './src/services/authService';
import bookingService from './src/services/bookingService';
import driverService from './src/services/driverService';
import earningsService from './src/services/earningsService';
import notificationService from './src/services/notificationService';
import { connectSocket, disconnectSocket, joinBookingRoom, subscribeToSocketEvents } from './src/services/socketService';
import { getToken, removeToken, saveToken } from './src/utils/authStorage';

const tabs = ['Requests', 'Trips', 'Earnings', 'Alerts', 'Profile'];
const colors = { ink: '#172B4D', muted: '#667085', teal: '#087F78', border: '#E4E7EC', bg: '#F6F8FA', danger: '#B42318' };

const messageFor = (error) => {
  if (!error?.response) return 'Unable to connect to the service. Check your network and try again.';
  return error.response.data?.message || error.message || 'The request could not be completed.';
};

function ActionButton({ label, onPress, secondary = false, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: secondary ? '#FFFFFF' : colors.teal,
        borderColor: colors.teal,
        borderWidth: 1,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 9,
        opacity: disabled ? 0.55 : 1,
        alignItems: 'center'
      }}
    >
      <Text style={{ color: secondary ? colors.teal : '#FFFFFF', fontWeight: '700' }}>{label}</Text>
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
      <View style={{ backgroundColor: '#FFFFFF', padding: 22, borderRadius: 16, gap: 14 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink }}>Driver sign in</Text>
        <Text style={{ color: colors.muted }}>Use the phone number registered with your driver account.</Text>
        <TextInput
          accessibilityLabel="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          autoCapitalize="none"
          style={inputStyle}
        />
        <TextInput
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
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
  borderRadius: 9,
  padding: 12,
  color: colors.ink,
  backgroundColor: '#FFFFFF'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('Requests');
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
      if (activeTab === 'Requests') {
        const response = await bookingService.getRequests({ page: 1, limit: 30 });
        setRequests(response.data?.data?.bookings || []);
      } else if (activeTab === 'Trips') {
        const response = await bookingService.getMyBookings({ page: 1, limit: 30 });
        setTrips(response.data?.data?.bookings || []);
      } else if (activeTab === 'Earnings') {
        const [summary, list] = await Promise.all([
          earningsService.getSummary(),
          earningsService.getEarnings({ page: 1, limit: 30 })
        ]);
        setEarningsSummary(summary.data?.data || null);
        setEarnings(list.data?.data?.earnings || []);
      } else if (activeTab === 'Alerts') {
        const [list, unread] = await Promise.all([
          notificationService.getNotifications({ page: 1, limit: 30 }),
          notificationService.getUnreadCount()
        ]);
        setNotifications(list.data?.data?.notifications || []);
        setUnreadCount(unread.data?.data?.count || 0);
      } else if (activeTab === 'Profile') {
        const [driverResponse, vehicleResponse] = await Promise.all([
          driverService.getProfile(),
          driverService.getVehicles()
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
    return <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.teal} /></SafeAreaView>;
  }
  if (!user) return <Login onLogin={signIn} onRetry={restoreSession} initialError={error} />;

  const bookings = activeTab === 'Requests' ? requests : trips;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>LoadBalbin Driver</Text>
        <Text style={{ color: colors.muted, marginTop: 3 }}>{user.name || user.phone}</Text>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.border }}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => { setActiveTab(tab); setError(''); }} style={{ padding: 11, borderBottomWidth: activeTab === tab ? 2 : 0, borderColor: colors.teal }}>
            <Text style={{ color: activeTab === tab ? colors.teal : colors.muted, fontWeight: '700' }}>{tab}{tab === 'Alerts' && unreadCount ? ` (${unreadCount})` : ''}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        {notice ? <Text style={{ color: colors.teal }}>{notice}</Text> : null}
        {loading && !refreshing ? <ActivityIndicator color={colors.teal} /> : null}
        {activeTab === 'Requests' && (
          <>
            <Text style={sectionTitle}>Available booking requests</Text>
            {!loading && requests.length === 0 ? <Text style={mutedText}>No available requests.</Text> : null}
            {requests.map((booking) => (
              <BookingCard key={booking._id} booking={booking} onAction={runAction} actions={['accept', 'reject']} />
            ))}
          </>
        )}
        {activeTab === 'Trips' && (
          <>
            <Text style={sectionTitle}>Your bookings</Text>
            {!loading && trips.length === 0 ? <Text style={mutedText}>No bookings yet.</Text> : null}
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
            <Text style={sectionTitle}>Earnings summary</Text>
            {earningsSummary ? (
              <View style={cardStyle}>
                <Text style={bodyText}>Completed trips: {earningsSummary.completedTrips ?? 0}</Text>
                <Text style={bodyText}>Total earnings: ₹{earningsSummary.totalEarnings ?? 0}</Text>
                <Text style={bodyText}>This period: ₹{earningsSummary.currentPeriodEarnings ?? 0}</Text>
              </View>
            ) : !loading ? <Text style={mutedText}>No earnings data available.</Text> : null}
            <Text style={sectionTitle}>Completed trips</Text>
            {earnings.map((item) => (
              <View key={item._id || item.bookingId} style={cardStyle}>
                <Text style={bodyText}>{item.bookingId}</Text>
                <Text style={mutedText}>{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '—'}</Text>
                <Text style={bodyText}>₹{item.finalFare ?? item.estimatedFare ?? 0}</Text>
              </View>
            ))}
          </>
        )}
        {activeTab === 'Alerts' && (
          <>
            <Text style={sectionTitle}>Notifications ({unreadCount} unread)</Text>
            {!loading && notifications.length === 0 ? <Text style={mutedText}>No notifications.</Text> : null}
            {notifications.map((item) => (
              <View key={item._id} style={cardStyle}>
                <Text style={bodyText}>{item.title}</Text>
                <Text style={mutedText}>{item.message}</Text>
                {!item.isRead ? <ActionButton label="Mark read" secondary onPress={() => markRead(item._id)} /> : <Text style={mutedText}>Read</Text>}
              </View>
            ))}
          </>
        )}
        {activeTab === 'Profile' && (
          <>
            <Text style={sectionTitle}>Driver profile</Text>
            {profile ? (
              <View style={cardStyle}>
                <Text style={bodyText}>{profile.fullName || profile.user?.name || user.name}</Text>
                <Text style={mutedText}>{profile.phone || profile.user?.phone || user.phone}</Text>
                <Text style={mutedText}>{profile.email || profile.user?.email || user.email}</Text>
                <Text style={bodyText}>Approval: {profile.approvalStatus}</Text>
                <Text style={bodyText}>Online: {driver?.isOnline ? 'Yes' : 'No'}</Text>
                <ActionButton label={driver?.isOnline ? 'Go offline' : 'Go online'} onPress={toggleOnline} />
                <Text style={sectionTitle}>Vehicles</Text>
                {(profile.vehicles || []).map((item) => (
                  <Text key={item._id} style={mutedText}>{item.vehicleNumber} · {item.vehicleModel} · {item.vehicleType}</Text>
                ))}
              </View>
            ) : !loading ? <Text style={mutedText}>Driver profile unavailable.</Text> : null}
            <ActionButton label="Sign out" secondary onPress={logout} />
          </>
        )}
        {lastEvent ? <Text style={mutedText}>Latest update: {lastEvent}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({ booking, actions, onAction }) {
  const customer = booking.customer;
  return (
    <View style={cardStyle}>
      <Text style={bodyText}>{booking.bookingId || 'Booking request'}</Text>
      <Text style={mutedText}>Status: {booking.bookingStatus}</Text>
      <Text style={mutedText}>Customer: {customer?.name || customer?.phone || 'Customer'}</Text>
      {customer?.phone ? <Text style={mutedText}>Contact: {customer.phone}</Text> : null}
      <Text style={mutedText}>Pickup: {booking.pickup?.address || '—'}</Text>
      <Text style={mutedText}>Drop: {booking.drop?.address || '—'}</Text>
      <Text style={mutedText}>Goods: {booking.goods} · {booking.weight?.value} {booking.weight?.unit}</Text>
      <Text style={bodyText}>Estimated fare: ₹{booking.estimatedFare ?? 0}</Text>
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {actions.map((action) => (
            <View key={action} style={{ flex: 1 }}>
              <ActionButton
                label={action[0].toUpperCase() + action.slice(1)}
                secondary={action === 'reject'}
                onPress={() => onAction(action, booking)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const cardStyle = { backgroundColor: '#FFFFFF', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 };
const sectionTitle = { color: colors.ink, fontSize: 17, fontWeight: '800' };
const bodyText = { color: colors.ink, fontWeight: '700' };
const mutedText = { color: colors.muted };
