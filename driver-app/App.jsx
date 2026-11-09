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
  Modal,
  Linking
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api, { setAuthenticationExpiredHandler } from './src/services/api';
import authService from './src/services/authService';
import agencyService from './src/services/agencyService';
import bookingService from './src/services/bookingService';
import driverService from './src/services/driverService';
import earningsService from './src/services/earningsService';
import notificationService from './src/services/notificationService';
import { connectSocket, disconnectSocket, joinBookingRoom, leaveBookingRoom, subscribeToSocketEvents } from './src/services/socketService';
import { getToken, removeToken, saveToken } from './src/utils/authStorage';
import { getDriverBookingEligibility, getDriverStatusIndicators } from './src/utils/driverBookingEligibility.mjs';
import LoadBalbinLogo from './src/components/LoadBalbinLogo';
import BannerCarousel from './src/components/BannerCarousel';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import AgencyRegistrationScreen from './src/screens/auth/AgencyRegistrationScreen';
import AgencyOwnerDashboard from './src/screens/agency/AgencyOwnerDashboard';
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

const documentStatusLabel = (status) => ({
  not_uploaded: 'Upload Required',
  pending: 'Pending Super Admin Verification',
  approved: 'Verified',
  rejected: 'Rejected'
}[status] || 'Upload Required');

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

function Login({ onLogin, onRetry, onRegister, onAgencyRegister, initialError, initialNotice }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [accountRole, setAccountRole] = useState('driver');
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
      await onLogin({ identifier: cleanId, password, role: accountRole });
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
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>Sign in</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Choose your account type. Access is determined by your authenticated account role.</Text>
        {initialNotice ? <Text accessibilityRole="status" style={{ color: colors.green, fontSize: 13 }}>{initialNotice}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { value: 'driver', label: 'Driver' },
            { value: 'agency', label: 'Agency Owner' }
          ].map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setAccountRole(option.value)}
              style={{ flex: 1, padding: 11, borderRadius: 9, alignItems: 'center', backgroundColor: accountRole === option.value ? colors.primary : colors.card, borderWidth: 1, borderColor: accountRole === option.value ? colors.primary : colors.border }}
            >
              <Text style={{ color: colors.ink, fontWeight: '800' }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

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
        <Pressable accessibilityRole="button" onPress={onRegister} style={{ padding: 6, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Register as a driver</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAgencyRegister} style={{ padding: 6, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Register as an Agency Owner</Text>
        </Pressable>

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
  const [showDriverRegistration, setShowDriverRegistration] = useState(false);
  const [showAgencyRegistration, setShowAgencyRegistration] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState('');
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [driver, setDriver] = useState(null);
  const [profile, setProfile] = useState(null);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [bookingEligibility, setBookingEligibility] = useState(null);
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
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentUploadProgress, setDocumentUploadProgress] = useState(0);
  const [documentUploadLoading, setDocumentUploadLoading] = useState(false);
  const [documentUploadError, setDocumentUploadError] = useState('');
  const [changeAgencyModalOpen, setChangeAgencyModalOpen] = useState(false);
  const [agenciesList, setAgenciesList] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [changeAgencySubmitting, setChangeAgencySubmitting] = useState(false);
  const [changeAgencyError, setChangeAgencyError] = useState('');
  const [selectedTripDetails, setSelectedTripDetails] = useState(null);
  const [tripFilter, setTripFilter] = useState('all');
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [driverRatingsData, setDriverRatingsData] = useState(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const fetchRatings = useCallback(async () => {
    setRatingsLoading(true);
    try {
      const res = await driverService.getRatings();
      setDriverRatingsData(res.data?.data || null);
    } catch (err) {
      // quiet fallback
    } finally {
      setRatingsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await removeToken();
    setToken(null);
    setUser(null);
    setDriver(null);
    setProfile(null);
    setAgencyProfile(null);
    setBookingEligibility(null);
    setRequests([]);
    setTrips([]);
    setEarnings([]);
    setEarningsSummary(null);
    setNotifications([]);
    setUnreadCount(0);
    setError('');
    setNotice('');
    setActiveTab('Home');
  }, []);

  const establish = useCallback(async (newToken) => {
    await saveToken(newToken);
    const response = await authService.getMe();
    const currentUser = response.data?.data?.user;
    if (currentUser?.role === 'driver') {
      const profileResponse = await driverService.getProfile();
      const currentDriver = profileResponse.data?.data?.driver;
      if (!currentDriver?._id) throw new Error('The authenticated Driver profile was not returned by the service.');
      setDriver(currentDriver);
      setProfile(currentDriver);
      setBookingEligibility(getDriverBookingEligibility(currentDriver));
      setAgencyProfile(null);
      setActiveTab('Home');
    } else if (currentUser?.role === 'agency') {
      const agencyResponse = await agencyService.getMyAgency();
      const currentAgency = agencyResponse.data?.data?.agency;
      if (!currentAgency?._id) throw new Error('The authenticated Agency profile was not returned by the service.');
      setAgencyProfile(currentAgency);
      setDriver(null);
      setProfile(null);
      setActiveTab('Overview');
    } else {
      await removeToken();
      throw new Error('This mobile app supports Driver and Agency Owner accounts only. Use the Super Admin Web Admin Panel for admin accounts.');
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
      setDriver(null);
      setProfile(null);
      setAgencyProfile(null);
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
    if (!user || user.role !== 'driver') return;
    setLoading(true);
    setError('');
    try {
      fetchUnreadNotificationsCount();

      if (activeTab === 'Home' || activeTab === 'Requests') {
        setRequests([]);
        setBookingEligibility(null);
        const driverResponse = await driverService.getProfile();
        const freshDriver = driverResponse.data?.data?.driver || null;
        const eligibility = getDriverBookingEligibility(freshDriver);
        setDriver(freshDriver);
        setBookingEligibility(eligibility);
        setProfile((current) => current && freshDriver
          ? { ...current, ...freshDriver }
          : current);

        if (activeTab === 'Home') {
          const [summaryResponse, tripsResponse] = await Promise.all([
            earningsService.getSummary().catch(() => ({ data: { data: null } })),
            bookingService.getMyBookings({ page: 1, limit: 10 }).catch(() => ({ data: { data: { bookings: [] } } }))
          ]);
          setEarningsSummary(summaryResponse.data?.data || null);
          setTrips(tripsResponse.data?.data?.bookings || []);
        }

        if (!eligibility.eligible) return;

        const reqResponse = await bookingService.getRequests({
          page: 1,
          limit: activeTab === 'Home' ? 10 : 30
        });
        setRequests(reqResponse.data?.data?.bookings || []);
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
        const driverResponse = await driverService.getProfile();
        const driverProfile = driverResponse.data?.data?.driver || null;
        setDriver(driverProfile);
        setBookingEligibility(getDriverBookingEligibility(driverProfile));
        setProfile(driverProfile);
        fetchRatings();
      }
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, refreshKey, user, fetchUnreadNotificationsCount, fetchRatings]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return undefined;
    }
    let unsubscribe = () => { };
    try {
      const activeSocket = connectSocket(token, user?.role);
      if (!activeSocket) {
        setError('Realtime connection is unavailable. Booking details remain available; pull to refresh for updates.');
      }
    } catch (socketError) {
      setError('Realtime connection is unavailable. Booking details will remain available; pull to refresh for updates.');
      console.error('Socket initialization failed:', socketError);
    }
    unsubscribe = subscribeToSocketEvents((event, payload) => {
      if (event === 'socket:error') setError('Realtime connection is unavailable. Booking details remain available; pull to refresh for updates.');
      if (payload?.bookingId || event === 'notification:new') {
        setRefreshKey((key) => key + 1);
        fetchUnreadNotificationsCount();
      }
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, [token, user?.role, fetchUnreadNotificationsCount]);

  useEffect(() => {
    if (activeTab !== 'Trips' || !trips.length) return;
    const activeBookingIds = trips
      .filter((booking) => booking.bookingStatus === 'accepted' || booking.bookingStatus === 'in-progress')
      .map((booking) => booking._id)
      .filter(Boolean);
    activeBookingIds.forEach((bookingId) => joinBookingRoom(bookingId));
    return () => activeBookingIds.forEach((bookingId) => leaveBookingRoom(bookingId));
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
      if (action === 'collect-cash') await bookingService.confirmCashCollection(id, 'Cash collected by driver');
      if (action === 'accept') joinBookingRoom(id);
      setNotice(`Booking ${action === 'start' ? 'trip started' : action === 'complete' ? 'completed' : action === 'collect-cash' ? 'cash collection confirmed' : `${action}ed`}.`);
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

  const openChangeAgencyModal = async () => {
    setChangeAgencyModalOpen(true);
    setAgenciesLoading(true);
    setChangeAgencyError('');
    try {
      const res = await authService.getVerifiedAgencies();
      setAgenciesList(res.data?.data?.agencies || []);
    } catch (e) {
      setChangeAgencyError('Could not load available agencies.');
    } finally {
      setAgenciesLoading(false);
    }
  };

  const submitChangeAgency = async (newAgencyId) => {
    setChangeAgencySubmitting(true);
    setChangeAgencyError('');
    try {
      await driverService.requestAgencyAssociation(newAgencyId);
      setChangeAgencyModalOpen(false);
      setNotice(newAgencyId ? 'Agency association requested. Awaiting agency review.' : 'Switched to Independent Driver.');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setChangeAgencyError(messageFor(e));
    } finally {
      setChangeAgencySubmitting(false);
    }
  };

  const chooseDocument = async (document) => {
    setError('');
    setDocumentUploadError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) {
        setError('The file picker did not return a document. Please try again.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('The selected file is larger than the 5 MB limit.');
        return;
      }
      const extension = file.name?.split('.').pop()?.toLowerCase();
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
      const pickerMimeType = file.mimeType?.toLowerCase() === 'image/jpg'
        ? 'image/jpeg'
        : file.mimeType?.toLowerCase();
      if (
        (pickerMimeType && !allowedTypes.includes(pickerMimeType)) ||
        (extension && !allowedExtensions.includes(extension))
      ) {
        setError('Choose a JPEG, PNG, WebP, or PDF document.');
        return;
      }
      setSelectedDocument({ ...document, file });
      setDocumentUploadProgress(0);
      setDocumentUploadError('');
    } catch (pickerError) {
      setDocumentUploadError(messageFor(pickerError));
    }
  };

  const submitDocument = async () => {
    if (!selectedDocument || documentUploadLoading) return;
    const { file } = selectedDocument;
    const formData = new FormData();
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const extensionMimeType = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      pdf: 'application/pdf'
    }[extension];
    const selectedMimeType = file.mimeType?.toLowerCase();
    const mimeType = selectedMimeType === 'image/jpg' ? 'image/jpeg' : (selectedMimeType || extensionMimeType);
    if (!mimeType) {
      setDocumentUploadError('The selected file type could not be identified. Choose a JPEG, PNG, WebP, or PDF document.');
      return;
    }
    if (Platform.OS === 'web' && file.file) {
      formData.append('document', file.file, file.name);
    } else {
      formData.append('document', {
        uri: file.uri,
        name: file.name || 'document',
        type: mimeType
      });
    }

    setError('');
    setNotice('');
    setDocumentUploadLoading(true);
    setDocumentUploadProgress(0);
    try {
      const progress = (event) => {
        if (event.total) {
          setDocumentUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
      if (selectedDocument.vehicleId) {
        await driverService.uploadVehicleDocument(
          selectedDocument.vehicleId,
          selectedDocument.docType,
          formData,
          progress
        );
      } else {
        await driverService.uploadDocument(
          profile?._id,
          selectedDocument.docType,
          formData,
          progress
        );
      }
      setSelectedDocument(null);
      setNotice('Document submitted securely for administrator review.');
      setRefreshKey((key) => key + 1);
    } catch (uploadError) {
      setDocumentUploadError(messageFor(uploadError));
    } finally {
      setDocumentUploadLoading(false);
      setDocumentUploadProgress(0);
    }
  };

  const viewDocument = async (document, vehicleId = null) => {
    try {
      const docType = document.docType || document.key;
      const response = vehicleId
        ? await driverService.getVehicleDocument(vehicleId, docType)
        : await driverService.getDocument(profile?._id, docType);
      const url = response.data?.data?.document?.viewUrl;
      if (!url) {
        setError('This submission is not available through secure document viewing.');
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
      else await Linking.openURL(url);
    } catch (viewError) {
      setError(messageFor(viewError));
    }
  };

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    if (showAgencyRegistration) {
      return (
        <AgencyRegistrationScreen
          onCancel={() => setShowAgencyRegistration(false)}
          onRegistered={async (newToken) => {
            await establish(newToken);
            setShowAgencyRegistration(false);
            setRegistrationNotice('Agency registration submitted. Its status and document reviews are available in Profile & KYC.');
          }}
        />
      );
    }
    if (showDriverRegistration) {
      return (
        <RegisterScreen
          onCancel={() => setShowDriverRegistration(false)}
          onRegistered={() => {
            setShowDriverRegistration(false);
            setRegistrationNotice('Registration submitted. You can sign in after the Super Admin approves your driver account.');
          }}
        />
      );
    }
    return (
      <Login
        onLogin={signIn}
        onRetry={restoreSession}
        onRegister={() => {
          setRegistrationNotice('');
          setShowDriverRegistration(true);
        }}
        onAgencyRegister={() => {
          setRegistrationNotice('');
          setShowAgencyRegistration(true);
        }}
        initialError={error}
        initialNotice={registrationNotice}
      />
    );
  }

  if (user.role === 'agency') {
    return (
      <AgencyOwnerDashboard
        user={user}
        initialAgency={agencyProfile}
        refreshKey={refreshKey}
        onLogout={logout}
      />
    );
  }

  const driverNameDisplay = (driver?.fullName || user?.name || "DRIVER").toUpperCase();
  const hasVehicle = profile?.vehicles && profile.vehicles.length > 0;
  const hasAgency = Boolean(profile?.agency);
  const agencyAssociationStatus = hasAgency ? profile?.agencyAssociation?.status || 'pending' : 'none';
  const identityDocumentsApproved = profile?.documents?.idProof?.status === 'approved'
    && profile?.documents?.drivingLicense?.status === 'approved';
  const personalKycMessage = hasAgency && agencyAssociationStatus === 'pending'
    ? 'Awaiting Agency Admin approval.'
    : hasAgency && agencyAssociationStatus === 'rejected'
      ? 'Your agency association was rejected. Contact your Agency Admin.'
      : identityDocumentsApproved && profile?.approvalStatus === 'approved'
        ? 'Identity verification completed.'
        : identityDocumentsApproved && profile?.approvalStatus === 'pending'
          ? 'Awaiting final Super Admin approval.'
          : hasAgency && agencyAssociationStatus === 'approved'
            ? 'Your agency has accepted your request. Your Aadhaar and Driving Licence are awaiting Super Admin verification.'
            : 'Your Aadhaar and Driving Licence are awaiting Super Admin verification.';
  const vehicleDocumentsPending = (profile?.vehicles || []).some((vehicle) =>
    ['registration', 'insurance'].some((key) => vehicle.documents?.[key]?.status !== 'approved')
  );
  const renderBookingEligibility = () => {
    const indicators = getDriverStatusIndicators(driver, profile?.vehicles || []);
    const isAgencyLinked = Boolean(driver?.agency);
    const agencyRejected = isAgencyLinked && indicators.agencyAssociation.status === 'rejected';

    const getBadgeStyle = (status) => {
      if (status === 'approved' || status === 'eligible') {
        return { bg: 'rgba(34, 197, 94, 0.15)', text: colors.green, border: colors.green };
      }
      if (status === 'rejected') {
        return { bg: 'rgba(239, 68, 68, 0.15)', text: colors.danger, border: colors.danger };
      }
      return { bg: 'rgba(245, 158, 11, 0.15)', text: colors.warning, border: colors.warning };
    };

    return (
      <View style={[cardStyle, { gap: 14, borderWidth: 1, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>
            Verification &amp; Approval Status
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Dual Approval</Text>
        </View>

        {/* Selected Agency Information */}
        {isAgencyLinked ? (
          <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Selected Transport Agency</Text>
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, marginTop: 2 }}>
              {driver.agency?.agencyName || 'Agency Fleet'}
            </Text>
            {driver.agency?.city ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>City: {driver.agency.city}</Text>
            ) : null}
            {driver.agency?.phone ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Contact: {driver.agency.phone}</Text>
            ) : null}
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Selected Transport Agency</Text>
            <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14, marginTop: 2 }}>
              Independent Driver (No agency approval required)
            </Text>
          </View>
        )}

        {/* 5 Status Indicators */}
        <View style={{ gap: 8 }}>
          {[
            {
              title: '1. Agency Association',
              indicator: indicators.agencyAssociation,
              note: !isAgencyLinked ? 'Skipped for Independent Driver' : (indicators.agencyAssociation.status === 'pending' ? 'Pending agency admin approval' : '')
            },
            {
              title: '2. Identity Proof (Aadhaar)',
              indicator: indicators.aadhaar,
              note: indicators.aadhaar.status === 'not_uploaded' ? 'Upload required in Profile' : ''
            },
            {
              title: '3. Driving Licence',
              indicator: indicators.drivingLicense,
              note: indicators.drivingLicense.status === 'not_uploaded' ? 'Upload required in Profile' : ''
            },
            {
              title: '4. Super Admin Account Approval',
              indicator: indicators.superAdminApproval,
              note: indicators.superAdminApproval.status === 'pending' ? 'Pending Super Admin approval' : ''
            },
            {
              title: '5. Vehicle Assignment',
              indicator: indicators.vehicleAssignment,
              note: indicators.vehicleAssignment.status === 'pending' ? 'Active vehicle with approved RC & Insurance needed' : ''
            }
          ].map(({ title, indicator, note }) => {
            const badge = getBadgeStyle(indicator.status);
            return (
              <View key={title} style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{title}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: badge.bg, borderWidth: 1, borderColor: badge.border }}>
                    <Text style={{ color: badge.text, fontSize: 11, fontWeight: '800' }}>{indicator.label}</Text>
                  </View>
                </View>
                {indicator.rejectionReason ? (
                  <Text style={{ color: colors.danger, fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                    Rejection reason: {indicator.rejectionReason}
                  </Text>
                ) : note ? (
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{note}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Agency rejection alert & Request Another Agency action */}
        {agencyRejected && (
          <View style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, borderWidth: 1, borderColor: colors.danger, gap: 8 }}>
            <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 13 }}>
              Agency Request Rejected
            </Text>
            <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>
              {indicators.agencyAssociation.rejectionReason || 'The selected agency rejected your joining request.'} You may choose another verified agency or switch to an independent driver.
            </Text>
            <ActionButton
              label="Request Another Agency"
              onPress={openChangeAgencyModal}
              style={{ paddingVertical: 10 }}
              textStyle={{ fontSize: 13 }}
            />
          </View>
        )}

        {/* Summary note when not fully eligible */}
        {bookingEligibility && !bookingEligibility.eligible && (
          <View style={{ padding: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>
              {bookingEligibility.title}
            </Text>
            <Text style={[mutedText, { fontSize: 11, marginTop: 2 }]}>
              {bookingEligibility.message}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <ActionButton
            label="Upload KYC Documents"
            secondary
            onPress={() => setActiveTab('Profile')}
            style={{ flex: 1, paddingVertical: 10 }}
            textStyle={{ fontSize: 12 }}
          />
          {isAgencyLinked && !agencyRejected && (
            <ActionButton
              label="Change Agency"
              secondary
              onPress={openChangeAgencyModal}
              style={{ flex: 1, paddingVertical: 10 }}
              textStyle={{ fontSize: 12 }}
            />
          )}
        </View>
      </View>
    );
  };

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
        {error ? (
          <View style={{ padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, gap: 8 }}>
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              disabled={loading || refreshing}
              style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.danger }}
            >
              <Text style={{ color: colors.ink, fontWeight: '700' }}>{loading || refreshing ? 'Retrying…' : 'Retry / Refresh'}</Text>
            </Pressable>
          </View>
        ) : null}
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

            {/* QUICK ACTIONS ROW */}
            <View style={{ marginTop: 12 }}>
              <Text style={[sectionTitle, { marginBottom: 8 }]}>QUICK ACTIONS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab('Requests')}
                  style={[cardStyle, { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <View style={{ position: 'relative' }}>
                    <Ionicons name="cube-outline" size={22} color={colors.primary} />
                    {requests.length > 0 && (
                      <View style={{ position: 'absolute', top: -4, right: -10, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{requests.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 4 }}>Requests</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab('Trips')}
                  style={[cardStyle, { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <MaterialCommunityIcons name="truck-outline" size={22} color={colors.teal} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 4 }}>Trips</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab('Earnings')}
                  style={[cardStyle, { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <Ionicons name="wallet-outline" size={22} color={colors.accent} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 4 }}>Earnings</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab('Profile')}
                  style={[cardStyle, { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={22} color={colors.green} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 4 }}>KYC Docs</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => Linking.openURL('tel:18001234567').catch(() => { })}
                  style={[cardStyle, { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' }]}
                >
                  <Ionicons name="headset-outline" size={22} color={colors.warning} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11, marginTop: 4 }}>Support</Text>
                </Pressable>
              </View>
            </View>

            {/* ACTIVE TRIP CARD */}
            {(() => {
              const activeTrip = trips.find((t) => ['accepted', 'in-progress'].includes(t.bookingStatus));
              if (!activeTrip) return null;
              const isInProgress = activeTrip.bookingStatus === 'in-progress';
              const isCOD = (activeTrip.paymentMethod || 'COD') === 'COD';
              const isPaid = activeTrip.paymentStatus === 'paid';

              return (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[sectionTitle, { color: isInProgress ? colors.accent : colors.teal }]}>
                      {isInProgress ? 'ACTIVE TRIP IN PROGRESS' : 'TRIP ACCEPTED · READY TO START'}
                    </Text>
                    <Pressable onPress={() => setSelectedTripDetails(activeTrip)}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>View Details ›</Text>
                    </Pressable>
                  </View>

                  <View style={[cardStyle, { borderColor: isInProgress ? colors.accent : colors.teal, borderWidth: 1.5, padding: 16 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: colors.teal, fontWeight: '800', fontSize: 14 }}>#{activeTrip.bookingId}</Text>
                        <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>₹{activeTrip.finalFare || activeTrip.estimatedFare || 0}</Text>
                      </View>
                      <View style={{
                        backgroundColor: isInProgress ? 'rgba(255, 122, 0, 0.15)' : 'rgba(20, 184, 166, 0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6
                      }}>
                        <Text style={{
                          color: isInProgress ? colors.accent : colors.teal,
                          fontSize: 10,
                          fontWeight: '800',
                          textTransform: 'uppercase'
                        }}>
                          {isInProgress ? 'EN ROUTE' : 'ACCEPTED'}
                        </Text>
                      </View>
                    </View>

                    {/* Route snippet */}
                    <View style={{ gap: 4, marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 5 }} />
                        <Text style={[bodyText, { flex: 1, fontSize: 13 }]} numberOfLines={1}>{activeTrip.pickup?.address || 'Pickup'}</Text>
                      </View>
                      <View style={{ width: 1, height: 6, backgroundColor: colors.border, marginLeft: 3 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 }} />
                        <Text style={[bodyText, { flex: 1, fontSize: 13 }]} numberOfLines={1}>{activeTrip.drop?.address || 'Drop'}</Text>
                      </View>
                    </View>

                    {/* Customer & Call button */}
                    {activeTrip.customer ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: colors.card2, borderRadius: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>{activeTrip.customer.name || 'Customer'}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{activeTrip.customer.phone || 'No phone'}</Text>
                        </View>
                        {activeTrip.customer.phone ? (
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${activeTrip.customer.phone}`).catch(() => { })}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                          >
                            <Ionicons name="call" size={13} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Call</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      {!isInProgress ? (
                        <ActionButton
                          label={actionLoadingId === activeTrip._id ? 'Starting…' : 'Start Trip'}
                          disabled={actionLoadingId === activeTrip._id}
                          onPress={() => runAction('start', activeTrip)}
                          style={{ flex: 1, backgroundColor: colors.teal, borderColor: colors.teal }}
                          textStyle={{ color: '#000' }}
                        />
                      ) : (
                        <ActionButton
                          label={actionLoadingId === activeTrip._id ? 'Completing…' : 'Complete Trip'}
                          disabled={actionLoadingId === activeTrip._id}
                          onPress={() => runAction('complete', activeTrip)}
                          style={{ flex: 1, backgroundColor: colors.green, borderColor: colors.green }}
                          textStyle={{ color: '#000' }}
                        />
                      )}

                      {isCOD && !isPaid && isInProgress && (
                        <ActionButton
                          label={actionLoadingId === activeTrip._id ? '…' : `Collect Cash (₹${activeTrip.finalFare || activeTrip.estimatedFare || 0})`}
                          disabled={actionLoadingId === activeTrip._id}
                          onPress={() => runAction('collect-cash', activeTrip)}
                          style={{ flex: 1, backgroundColor: colors.warning, borderColor: colors.warning }}
                          textStyle={{ color: '#000' }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* ASSIGNED VEHICLE CARD */}
            <View style={{ marginTop: 12 }}>
              <Text style={[sectionTitle, { marginBottom: 8 }]}>ASSIGNED VEHICLE</Text>
              {driver?.vehicles && driver.vehicles.length > 0 ? (
                <View style={[cardStyle, { padding: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(8, 169, 245, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialCommunityIcons name="truck" size={22} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={[bodyText, { fontSize: 15 }]}>{driver.vehicles[0].vehicleModel || 'Fleet Vehicle'}</Text>
                        <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 12, marginTop: 2 }}>{driver.vehicles[0].vehicleNumber}</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: colors.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }}>
                        {driver.vehicles[0].vehicleType || 'Truck'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="speedometer-outline" size={13} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Cap: <Text style={{ color: colors.ink, fontWeight: '700' }}>{driver.vehicles[0].loadCapacity?.value || '—'} {driver.vehicles[0].loadCapacity?.unit || 'kg'}</Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons
                        name={driver.vehicles[0].documents?.registration?.status === 'approved' ? 'checkmark-circle' : 'alert-circle'}
                        size={13}
                        color={driver.vehicles[0].documents?.registration?.status === 'approved' ? colors.green : colors.warning}
                      />
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        RC: <Text style={{ color: driver.vehicles[0].documents?.registration?.status === 'approved' ? colors.green : colors.warning, fontWeight: '700' }}>
                          {driver.vehicles[0].documents?.registration?.status === 'approved' ? 'Verified' : 'Pending'}
                        </Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons
                        name={driver.vehicles[0].documents?.insurance?.status === 'approved' ? 'checkmark-circle' : 'alert-circle'}
                        size={13}
                        color={driver.vehicles[0].documents?.insurance?.status === 'approved' ? colors.green : colors.warning}
                      />
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        Ins: <Text style={{ color: driver.vehicles[0].documents?.insurance?.status === 'approved' ? colors.green : colors.warning, fontWeight: '700' }}>
                          {driver.vehicles[0].documents?.insurance?.status === 'approved' ? 'Verified' : 'Pending'}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[cardStyle, { padding: 14, alignItems: 'center' }]}>
                  <MaterialCommunityIcons name="truck-off" size={24} color={colors.muted} style={{ marginBottom: 4 }} />
                  <Text style={[bodyText, { fontSize: 13 }]}>No vehicle assigned</Text>
                  <Text style={[mutedText, { fontSize: 11, textAlign: 'center', marginTop: 2 }]}>
                    Contact your fleet agency or upload vehicle details in the Profile tab.
                  </Text>
                </View>
              )}
            </View>

            {renderBookingEligibility()}

            {requests.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, marginBottom: 8 }}>
                  <View>
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                      ASSIGNED BOOKINGS
                    </Text>
                    <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Bookings assigned to you</Text>
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
                    onViewDetails={() => setSelectedTripDetails(booking)}
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
                ASSIGNED BOOKING REQUESTS
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Bookings assigned to you</Text>
            </View>

            {renderBookingEligibility()}

            {!loading && bookingEligibility?.eligible && requests.length === 0 ? (
              <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}>
                <Ionicons name="cube-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={bodyText}>No bookings are awaiting your response.</Text>
                <Text style={[mutedText, { marginTop: 4, textAlign: 'center' }]}>
                  {driver?.isOnline ? 'Your agency will assign compatible bookings to you.' : 'Go online to be available for agency-assigned bookings.'}
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
                onViewDetails={() => setSelectedTripDetails(booking)}
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

            {/* SEGMENTED FILTER CHIPS */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${trips.length})` },
                { id: 'active', label: `Active (${trips.filter((t) => ['accepted', 'in-progress'].includes(t.bookingStatus)).length})` },
                { id: 'scheduled', label: `Scheduled (${trips.filter((t) => t.bookingMode === 'scheduled').length})` },
                { id: 'completed', label: `Completed (${trips.filter((t) => t.bookingStatus === 'completed').length})` }
              ].map((filter) => {
                const isSelected = tripFilter === filter.id;
                return (
                  <Pressable
                    key={filter.id}
                    onPress={() => setTripFilter(filter.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border
                    }}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : colors.muted, fontSize: 12, fontWeight: '700' }}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!loading && trips.length === 0 ? (
              <View style={[cardStyle, { alignItems: 'center', padding: 32 }]}>
                <Ionicons name="truck-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={bodyText}>No active or completed trips.</Text>
                <Text style={[mutedText, { marginTop: 4 }]}>Accepted trips will appear here.</Text>
              </View>
            ) : null}

            {trips
              .filter((booking) => {
                if (tripFilter === 'active') return ['accepted', 'in-progress'].includes(booking.bookingStatus);
                if (tripFilter === 'scheduled') return booking.bookingMode === 'scheduled';
                if (tripFilter === 'completed') return booking.bookingStatus === 'completed';
                return true;
              })
              .map((booking) => {
                const actions = [];
                if (booking.bookingStatus === 'accepted') {
                  actions.push('start');
                } else if (booking.bookingStatus === 'in-progress') {
                  actions.push('complete');
                }
                if (
                  (booking.bookingStatus === 'in-progress' || booking.bookingStatus === 'completed') &&
                  (booking.paymentMethod || 'COD') === 'COD' &&
                  booking.paymentStatus !== 'paid'
                ) {
                  actions.push('collect-cash');
                }
                return (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    onAction={runAction}
                    actions={actions}
                    actionLoading={actionLoadingId === booking._id}
                    onViewDetails={() => setSelectedTripDetails(booking)}
                  />
                );
              })}
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
                  KYC DOCUMENTS
                </Text>
                <Text style={[mutedText, { fontSize: 12, lineHeight: 18, marginBottom: 4 }]}>
                  {personalKycMessage}
                </Text>
                <View style={{ gap: 8 }}>
                  {[
                    { label: 'Driving Licence', key: 'drivingLicense', doc: profile.documents?.drivingLicense },
                    { label: 'Identity Proof (Aadhaar)', key: 'idProof', doc: profile.documents?.idProof }
                  ].map((item) => {
                    const status = item.doc?.status || 'not_uploaded';
                    const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.danger : colors.warning;
                    return (
                      <View key={item.key} style={{ padding: 12, backgroundColor: colors.card2, borderRadius: 8, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                            <Text style={[bodyText, { fontSize: 13, flexShrink: 1 }]}>{item.label}</Text>
                          </View>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>
                              {documentStatusLabel(status)}
                            </Text>
                          </View>
                        </View>
                        {item.doc?.submittedAt ? (
                          <Text style={[mutedText, { fontSize: 11 }]}>
                            Submitted {new Date(item.doc.submittedAt).toLocaleDateString()}
                          </Text>
                        ) : null}
                        {status === 'rejected' && item.doc?.rejectionReason ? (
                          <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}>
                            Rejection reason: {item.doc.rejectionReason}
                          </Text>
                        ) : null}
                        {status === 'pending' && item.doc?.viewUrl ? (
                          <Pressable onPress={() => viewDocument(item)}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View Submission</Text>
                          </Pressable>
                        ) : null}
                        {status !== 'pending' ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={documentUploadLoading || !profile?._id}
                            onPress={() => chooseDocument({ docType: item.key, label: item.label })}
                            style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary, alignSelf: 'flex-start', opacity: documentUploadLoading ? 0.55 : 1 }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                              {status === 'rejected' ? 'Re-upload Document' : status === 'approved' ? 'Replace Document' : 'Upload Document'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {vehicleDocumentsPending && profile.vehicles?.length > 0 ? (
                  <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
                    Your assigned vehicle&apos;s RC and Insurance need verification.
                  </Text>
                ) : null}

                {/* Vehicle-owned KYC */}
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 4 }}>
                  VEHICLE DOCUMENTS
                </Text>
                {(!profile.vehicles || profile.vehicles.length === 0) ? (
                  <Text style={mutedText}>Vehicle registration and insurance will appear here when a vehicle is assigned to your account.</Text>
                ) : null}
                {(profile.vehicles || []).map((item) => (
                  <View key={item._id} style={{ marginTop: 8, padding: 14, backgroundColor: colors.card2, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                    <View>
                      <Text style={[bodyText, { fontSize: 15, fontWeight: '700' }]}>{item.vehicleNumber}</Text>
                      <Text style={[mutedText, { marginTop: 3 }]}>{item.vehicleModel} · {item.vehicleType}</Text>
                    </View>
                    {[
                      { label: 'Vehicle Registration (RC)', key: 'registration', docType: 'registration' },
                      { label: 'Insurance Policy', key: 'insurance', docType: 'insurance' }
                    ].map((document) => {
                      const submission = item.documents?.[document.key];
                      const status = submission?.status || 'not_uploaded';
                      const statusColor = status === 'approved' ? colors.green : status === 'rejected' ? colors.danger : colors.warning;
                      const agencyOwned = Boolean(profile.agency || item.agency);
                      return (
                        <View key={`${item._id}-${document.key}`} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, gap: 7 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                              <Text style={[bodyText, { fontSize: 12, flexShrink: 1 }]}>{document.label}</Text>
                            </View>
                            <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{documentStatusLabel(status)}</Text>
                          </View>
                          {submission?.submittedAt ? (
                            <Text style={[mutedText, { fontSize: 10 }]}>
                              Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                            </Text>
                          ) : null}
                          {status === 'rejected' && submission?.rejectionReason ? (
                            <Text style={{ color: colors.danger, fontSize: 11 }}>
                              Rejection reason: {submission.rejectionReason}
                            </Text>
                          ) : null}
                          {agencyOwned ? (
                            <>
                              {status === 'pending' ? (
                                <Pressable onPress={() => viewDocument({ docType: document.docType }, item._id)}>
                                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>View Submission</Text>
                                </Pressable>
                              ) : null}
                              <Text style={[mutedText, { fontSize: 11 }]}>Agency must upload this document for the vehicle.</Text>
                            </>
                          ) : (
                            <>
                              {status === 'pending' ? (
                                <Pressable onPress={() => viewDocument({ docType: document.docType }, item._id)}>
                                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>View Submission</Text>
                                </Pressable>
                              ) : (
                                <Pressable
                                  accessibilityRole="button"
                                  disabled={documentUploadLoading}
                                  onPress={() => chooseDocument({
                                    docType: document.docType,
                                    vehicleId: item._id,
                                    label: `${item.vehicleNumber} ${document.label}`
                                  })}
                                  style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primary, alignSelf: 'flex-start', opacity: documentUploadLoading ? 0.55 : 1 }}
                                >
                                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                                    {status === 'rejected' ? 'Re-upload Document' : status === 'approved' ? 'Replace Document' : 'Upload Document'}
                                  </Text>
                                </Pressable>
                              )}
                            </>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : !loading ? <Text style={mutedText}>Driver profile unavailable.</Text> : null}

            {/* RATINGS & REVIEWS CARD */}
            <View style={[cardStyle, { marginTop: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[sectionTitle, { marginBottom: 4 }]}>CUSTOMER REVIEWS</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>
                      {driverRatingsData?.summary?.rating || driver?.rating || 5.0} ★
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      ({driverRatingsData?.summary?.ratingCount || driver?.ratingCount || 0} reviews · {driverRatingsData?.summary?.totalTrips || driver?.totalTrips || 0} trips)
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setReviewsModalOpen(true);
                    fetchRatings();
                  }}
                  style={{ backgroundColor: 'rgba(8, 169, 245, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.primary }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>See Reviews</Text>
                </Pressable>
              </View>
            </View>

            {/* CUSTOMER SUPPORT */}
            <View style={[cardStyle, { marginTop: 10 }]}>
              <Text style={bodyText}>Customer Support & Assistance</Text>
              <Text style={[mutedText, { marginTop: 4, marginBottom: 12, fontSize: 12 }]}>
                Have questions about trips, cash collections, or KYC verification? Reach our 24/7 transport support desk.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => Linking.openURL('tel:18001234567').catch(() => { })}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Ionicons name="call-outline" size={15} color={colors.primary} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>Call Helpline</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => Linking.openURL('mailto:help@loadbalbin.com').catch(() => { })}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 8 }}
                >
                  <Ionicons name="mail-outline" size={15} color={colors.teal} />
                  <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>Email Support</Text>
                </Pressable>
              </View>
            </View>
            <ActionButton label="Sign out" secondary onPress={logout} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>

      {/* CHANGE AGENCY MODAL */}
      <Modal visible={changeAgencyModalOpen} transparent animationType="fade" onRequestClose={() => setChangeAgencyModalOpen(false)}>
        <Pressable onPress={() => setChangeAgencyModalOpen(false)} style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 20 }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: colors.border, gap: 12 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Request Agency Association</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Choose a verified transport agency to submit a new association request, or select Independent Driver.
            </Text>
            {changeAgencyError ? (
              <Text style={{ color: colors.danger, fontSize: 12 }}>{changeAgencyError}</Text>
            ) : null}
            {agenciesLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ScrollView style={{ maxHeight: 260 }}>
                <Pressable
                  onPress={() => submitChangeAgency('')}
                  disabled={changeAgencySubmitting}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>Independent Driver / No Agency</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Self-managed vehicle and dispatches</Text>
                </Pressable>
                {agenciesList.map((ag) => (
                  <Pressable
                    key={ag._id}
                    onPress={() => submitChangeAgency(String(ag._id))}
                    disabled={changeAgencySubmitting}
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ color: colors.ink, fontWeight: '700' }}>{ag.agencyName}</Text>
                    {ag.city ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{ag.city}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <ActionButton
              label="Cancel"
              secondary
              onPress={() => setChangeAgencyModalOpen(false)}
              disabled={changeAgencySubmitting}
            />
          </Pressable>
        </Pressable>
      </Modal>

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

      <Modal
        visible={Boolean(selectedDocument)}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!documentUploadLoading) setSelectedDocument(null);
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View style={[cardStyle, { padding: 18, gap: 12, borderColor: colors.primary, borderWidth: 1 }]}>
            <Text style={[bodyText, { fontSize: 17, fontWeight: '800' }]}>
              Submit {selectedDocument?.label}
            </Text>
            {documentUploadError ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}>
                {documentUploadError}
              </Text>
            ) : null}
            <Text style={[mutedText, { fontSize: 12, lineHeight: 18 }]}>
              Accepted formats: JPEG, PNG, WebP, or PDF. Maximum file size: 5 MB.
            </Text>
            {selectedDocument?.file?.mimeType?.startsWith('image/') ? (
              <Image
                source={{ uri: selectedDocument.file.uri }}
                resizeMode="contain"
                style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.surface }}
              />
            ) : (
              <View style={{ padding: 16, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text-outline" size={30} color={colors.primary} />
                <Text style={[bodyText, { fontSize: 12, textAlign: 'center' }]}>{selectedDocument?.file?.name}</Text>
              </View>
            )}
            <Text style={[mutedText, { fontSize: 11 }]} numberOfLines={1}>
              {selectedDocument?.file?.name}
            </Text>
            {documentUploadLoading ? (
              <View style={{ gap: 6 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
                  <View style={{ width: `${documentUploadProgress}%`, height: '100%', backgroundColor: colors.primary }} />
                </View>
                <Text style={[mutedText, { fontSize: 11 }]}>{documentUploadProgress}% uploaded</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <ActionButton
                label="Cancel"
                secondary
                disabled={documentUploadLoading}
                onPress={() => {
                  setSelectedDocument(null);
                  setDocumentUploadError('');
                }}
                style={{ flex: 1 }}
              />
              <ActionButton
                label={documentUploadLoading ? 'Uploading…' : 'Upload / Submit'}
                disabled={documentUploadLoading}
                onPress={submitDocument}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* TRIP DETAILS MODAL */}
      <Modal
        visible={Boolean(selectedTripDetails)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTripDetails(null)}
      >
        <Pressable
          onPress={() => setSelectedTripDetails(null)}
          style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              maxHeight: '85%',
              padding: 20
            }}
          >
            {selectedTripDetails && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
                  <View>
                    <Text style={{ color: colors.teal, fontSize: 15, fontWeight: '800' }}>
                      #{selectedTripDetails.bookingId || 'BOOKING'}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>
                      {selectedTripDetails.bookingMode === 'scheduled' ? 'Scheduled Booking' : 'Instant Dispatch'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedTripDetails(null)}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={20} color={colors.muted} />
                  </Pressable>
                </View>

                {/* Status & Fare */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View>
                    <Text style={[labelStyle, { fontSize: 10 }]}>Fare Amount</Text>
                    <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                      ₹{selectedTripDetails.finalFare || selectedTripDetails.estimatedFare || 0}
                    </Text>
                    <Text style={{ color: (selectedTripDetails.paymentMethod || 'COD') === 'COD' ? colors.green : colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                      {(selectedTripDetails.paymentMethod || 'COD') === 'COD' ? 'Cash on Delivery (COD)' : 'Paid Online (Razorpay)'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{
                      backgroundColor: selectedTripDetails.paymentStatus === 'paid' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      marginBottom: 4
                    }}>
                      <Text style={{
                        color: selectedTripDetails.paymentStatus === 'paid' ? colors.green : colors.warning,
                        fontSize: 10,
                        fontWeight: '800',
                        textTransform: 'uppercase'
                      }}>
                        {selectedTripDetails.paymentStatus === 'paid' ? 'PAID' : 'PAYMENT PENDING'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11, textTransform: 'capitalize' }}>
                      Status: <Text style={{ color: colors.ink, fontWeight: '700' }}>{selectedTripDetails.bookingStatus}</Text>
                    </Text>
                  </View>
                </View>

                {/* Route details */}
                <View style={{ backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                  <Text style={sectionTitle}>TRIP ROUTE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[labelStyle, { fontSize: 10 }]}>Pickup Location</Text>
                      <Text style={[bodyText, { marginTop: 1, fontSize: 13 }]}>{selectedTripDetails.pickup?.address || 'Pickup address'}</Text>
                    </View>
                  </View>
                  <View style={{ width: 1, height: 8, backgroundColor: colors.border, marginLeft: 3 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[labelStyle, { fontSize: 10 }]}>Drop Location</Text>
                      <Text style={[bodyText, { marginTop: 1, fontSize: 13 }]}>{selectedTripDetails.drop?.address || 'Drop address'}</Text>
                    </View>
                  </View>
                  {selectedTripDetails.distanceKm ? (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      Estimated Road Distance: <Text style={{ color: colors.ink, fontWeight: '700' }}>{selectedTripDetails.distanceKm} km</Text>
                    </Text>
                  ) : null}
                  {selectedTripDetails.bookingMode === 'scheduled' && selectedTripDetails.preferredPickupDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: 8, borderRadius: 6 }}>
                      <Ionicons name="calendar" size={13} color={colors.warning} />
                      <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700' }}>
                        Pickup: {new Date(selectedTripDetails.preferredPickupDate).toLocaleDateString()} {selectedTripDetails.preferredPickupTime ? `at ${selectedTripDetails.preferredPickupTime}` : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Customer Details */}
                <View style={{ backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                  <Text style={sectionTitle}>CUSTOMER DETAILS</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[bodyText, { fontSize: 14 }]}>{selectedTripDetails.customer?.name || 'Customer'}</Text>
                      <Text style={[mutedText, { marginTop: 1, fontSize: 12 }]}>{selectedTripDetails.customer?.phone || 'Phone unavailable'}</Text>
                    </View>
                    {selectedTripDetails.customer?.phone ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => Linking.openURL(`tel:${selectedTripDetails.customer.phone}`).catch(() => { })}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                      >
                        <Ionicons name="call" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Call Customer</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {selectedTripDetails.customerNote ? (
                    <View style={{ backgroundColor: colors.card2, padding: 8, borderRadius: 6, marginTop: 2 }}>
                      <Text style={[labelStyle, { fontSize: 10, marginBottom: 1 }]}>Customer Note</Text>
                      <Text style={[mutedText, { fontSize: 11, color: colors.ink }]}>{selectedTripDetails.customerNote}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Cargo & Vehicle */}
                <View style={{ backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                  <Text style={sectionTitle}>CARGO SPECIFICATIONS</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={mutedText}>Goods / Material:</Text>
                    <Text style={[bodyText, { fontSize: 12 }]}>{selectedTripDetails.goods || 'General Cargo'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={mutedText}>Weight:</Text>
                    <Text style={[bodyText, { fontSize: 12 }]}>{selectedTripDetails.weight?.value || 0} {selectedTripDetails.weight?.unit || 'kg'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={mutedText}>Required Vehicle Type:</Text>
                    <Text style={[bodyText, { fontSize: 12, textTransform: 'capitalize' }]}>{selectedTripDetails.vehicleType || 'Truck'}</Text>
                  </View>
                  {selectedTripDetails.vehicle ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={mutedText}>Assigned Vehicle:</Text>
                      <Text style={[bodyText, { fontSize: 12 }]}>{selectedTripDetails.vehicle.vehicleNumber || selectedTripDetails.vehicle.vehicleModel}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Action buttons inside details modal */}
                <View style={{ gap: 8, marginTop: 4, marginBottom: 16 }}>
                  {selectedTripDetails.bookingStatus === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <ActionButton
                        label="Reject"
                        secondary
                        disabled={Boolean(actionLoadingId)}
                        onPress={async () => {
                          await runAction('reject', selectedTripDetails);
                          setSelectedTripDetails(null);
                        }}
                        style={{ flex: 1 }}
                      />
                      <ActionButton
                        label="Accept Booking"
                        disabled={Boolean(actionLoadingId)}
                        onPress={async () => {
                          await runAction('accept', selectedTripDetails);
                          setSelectedTripDetails(null);
                        }}
                        style={{ flex: 2 }}
                      />
                    </View>
                  )}

                  {selectedTripDetails.bookingStatus === 'accepted' && (
                    <ActionButton
                      label="Start Trip"
                      disabled={Boolean(actionLoadingId)}
                      onPress={async () => {
                        await runAction('start', selectedTripDetails);
                        setSelectedTripDetails(null);
                      }}
                      style={{ backgroundColor: colors.teal, borderColor: colors.teal }}
                      textStyle={{ color: '#000' }}
                    />
                  )}

                  {selectedTripDetails.bookingStatus === 'in-progress' && (
                    <ActionButton
                      label="Complete Trip"
                      disabled={Boolean(actionLoadingId)}
                      onPress={async () => {
                        await runAction('complete', selectedTripDetails);
                        setSelectedTripDetails(null);
                      }}
                      style={{ backgroundColor: colors.green, borderColor: colors.green }}
                      textStyle={{ color: '#000' }}
                    />
                  )}

                  {(selectedTripDetails.paymentMethod || 'COD') === 'COD' && selectedTripDetails.paymentStatus !== 'paid' && ['in-progress', 'completed'].includes(selectedTripDetails.bookingStatus) && (
                    <ActionButton
                      label={`Confirm Cash Collection (₹${selectedTripDetails.finalFare || selectedTripDetails.estimatedFare || 0})`}
                      disabled={Boolean(actionLoadingId)}
                      onPress={async () => {
                        await runAction('collect-cash', selectedTripDetails);
                        setSelectedTripDetails(null);
                      }}
                      style={{ backgroundColor: colors.warning, borderColor: colors.warning }}
                      textStyle={{ color: '#000' }}
                    />
                  )}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* CUSTOMER REVIEWS MODAL */}
      <Modal
        visible={reviewsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewsModalOpen(false)}
      >
        <Pressable
          onPress={() => setReviewsModalOpen(false)}
          style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              maxHeight: '80%',
              padding: 20
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Customer Reviews & Ratings</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReviewsModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 14 }}>
              {ratingsLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : !driverRatingsData?.ratings || driverRatingsData.ratings.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="star-outline" size={40} color={colors.muted} style={{ marginBottom: 10 }} />
                  <Text style={bodyText}>No customer reviews yet.</Text>
                  <Text style={[mutedText, { marginTop: 4, textAlign: 'center' }]}>
                    Customer feedback and ratings will appear here after you complete trips.
                  </Text>
                </View>
              ) : (
                driverRatingsData.ratings.map((rev) => (
                  <View key={rev._id} style={{ backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[bodyText, { fontSize: 14 }]}>{rev.customer?.name || 'Verified Customer'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= rev.rating ? 'star' : 'star-outline'}
                            size={14}
                            color={star <= rev.rating ? colors.accent : colors.muted}
                          />
                        ))}
                      </View>
                    </View>
                    {rev.feedback ? (
                      <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginTop: 2 }}>
                        &ldquo;{rev.feedback}&rdquo;
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                      {new Date(rev.createdAt).toLocaleDateString()} {rev.booking?.bookingId ? `· Booking #${rev.booking.bookingId}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
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
              onPress={() => {
                const returningFromProfile = activeTab === 'Profile' && tab.id !== 'Profile';
                setActiveTab(tab.id);
                if (returningFromProfile) setRefreshKey((key) => key + 1);
                setError('');
                setNotice('');
              }}
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

function BookingCard({ booking, actions = [], onAction, actionLoading, onViewDetails }) {
  const pickupDateFormatted = booking.preferredPickupDate
    ? new Date(booking.preferredPickupDate).toLocaleDateString()
    : null;
  const isScheduled = booking.bookingMode === 'scheduled';
  const isPending = booking.bookingStatus === 'pending';

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
            {booking.bookingStatus === 'pending' && (booking.assignmentStatus === 'pending_acceptance' || booking.driver)
              ? 'Awaiting your response'
              : booking.bookingStatus === 'accepted'
                ? 'Driver accepted'
                : booking.bookingStatus}
          </Text>
        </View>
      </View>

      {/* URGENCY / DISPATCH BADGE FOR PENDING REQUESTS */}
      {isPending && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isScheduled ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 }}>
          <Ionicons name={isScheduled ? 'calendar' : 'flash'} size={13} color={isScheduled ? colors.warning : colors.accent} />
          <Text style={{ color: isScheduled ? colors.warning : colors.accent, fontSize: 10, fontWeight: '800' }}>
            {isScheduled ? 'SCHEDULED DISPATCH · PLEASE CONFIRM PICKUP' : 'INSTANT DISPATCH · PLEASE RESPOND PROMPTLY'}
          </Text>
        </View>
      )}

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
      <View style={{ gap: 4, marginTop: 12 }}>
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
      <Text style={[mutedText, { fontSize: 12, marginTop: 12 }]}>
        {booking.vehicleType || 'Truck'} · {booking.goods || 'General Cargo'} · {booking.weight?.value || 0} {booking.weight?.unit || 'kg'}
        {booking.distanceKm ? ` · ${booking.distanceKm} km` : ''}
      </Text>

      {booking.vehicle ? (
        <Text style={[mutedText, { fontSize: 12, marginTop: 6 }]}>
          Vehicle: {booking.vehicle.vehicleNumber || booking.vehicle.vehicleModel || 'Assigned vehicle'}
          {booking.vehicle.loadCapacity?.value ? ` · Capacity ${booking.vehicle.loadCapacity.value} ${booking.vehicle.loadCapacity.unit || 'kg'}` : ''}
        </Text>
      ) : null}

      {/* CUSTOMER INFO & CALL BUTTON */}
      {booking.customer ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: colors.card2, borderRadius: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[bodyText, { fontSize: 12 }]}>{booking.customer.name || 'Customer'}</Text>
            <Text style={[mutedText, { fontSize: 11 }]}>{booking.customer.phone || 'No phone'}</Text>
          </View>
          {booking.customer.phone ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => Linking.openURL(`tel:${booking.customer.phone}`).catch(() => { })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
            >
              <Ionicons name="call" size={12} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Call</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* PAYMENT INFO */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: 10, backgroundColor: colors.card2, borderRadius: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons
            name={(booking.paymentMethod || 'COD') === 'COD' ? 'cash-multiple' : 'credit-card-outline'}
            size={18}
            color={(booking.paymentMethod || 'COD') === 'COD' ? colors.green : colors.primary}
          />
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>
            {(booking.paymentMethod || 'COD') === 'COD' ? 'Cash on Delivery (COD)' : 'Paid Online (Razorpay)'}
          </Text>
        </View>
        <View style={{
          backgroundColor: booking.paymentStatus === 'paid' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4
        }}>
          <Text style={{
            color: booking.paymentStatus === 'paid' ? colors.green : colors.warning,
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase'
          }}>
            {booking.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
          </Text>
        </View>
      </View>

      {/* CUSTOMER NOTE */}
      {booking.customerNote ? (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: colors.card2, borderRadius: 6 }}>
          <Text style={[mutedText, { fontSize: 11 }]}>Note: {booking.customerNote}</Text>
        </View>
      ) : null}
      {booking.rejectedReason ? (
        <Text style={{ color: colors.warning, fontSize: 11, marginTop: 8 }}>
          Previous response: {booking.rejectedReason}
        </Text>
      ) : null}

      {/* VIEW FULL DETAILS BUTTON */}
      {onViewDetails ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onViewDetails(booking)}
          style={{ marginTop: 10, alignItems: 'center', paddingVertical: 4 }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>View Full Route & Cargo Details ›</Text>
        </Pressable>
      ) : null}

      {/* ACTIONS */}
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          {actions.map((action) => {
            const isReject = action === 'reject';
            const isCollectCash = action === 'collect-cash';
            const label = action === 'accept'
              ? 'Accept Booking'
              : action === 'start'
                ? 'Start Trip'
                : action === 'complete'
                  ? 'Complete Trip'
                  : action === 'collect-cash'
                    ? `Confirm Cash Collection (₹${booking.finalFare || booking.estimatedFare || 0})`
                    : 'Reject Booking';
            return (
              <View key={action} style={!isReject ? { flex: 2 } : { flex: 1 }}>
                <ActionButton
                  label={actionLoading ? 'Processing…' : label}
                  secondary={isReject}
                  danger={false}
                  disabled={actionLoading}
                  onPress={() => onAction(action, booking)}
                  style={isCollectCash ? { backgroundColor: colors.green, borderColor: colors.green } : {}}
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
