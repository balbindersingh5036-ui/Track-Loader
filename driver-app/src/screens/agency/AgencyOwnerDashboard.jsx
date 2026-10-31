import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import agencyService from '../../services/agencyService';
import notificationService from '../../services/notificationService';

// Unified Theme & Components
import { theme } from './components/AgencyTheme';
import AgencyHeader from './components/AgencyHeader';
import AgencyBottomNav from './components/AgencyBottomNav';
import ToastBanner from './components/ToastBanner';
import LoadingSkeleton from './components/LoadingSkeleton';

// Modular Tabs
import OverviewTab from './tabs/OverviewTab';
import DriversTab from './tabs/DriversTab';
import FleetTab from './tabs/FleetTab';
import BookingsTab from './tabs/BookingsTab';
import MoreTab from './tabs/MoreTab';
import EarningsTab from './tabs/EarningsTab';
import ProfileKycTab from './tabs/ProfileKycTab';
import NotificationsTab from './tabs/NotificationsTab';
import SupportTab from './tabs/SupportTab';

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'The request could not be completed.';

export default function AgencyOwnerDashboard({ user, initialAgency, refreshKey, onLogout }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [agency, setAgency] = useState(initialAgency || null);
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Tab Modal Triggers
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);

  // Load all agency data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [
        profileResponse,
        statsResponse,
        driverResponse,
        requestResponse,
        vehicleResponse,
        bookingResponse
      ] = await Promise.all([
        agencyService.getMyAgency(),
        agencyService.getAgencyStats(),
        agencyService.getAgencyDrivers(),
        agencyService.getAgencyDriverRequests(),
        agencyService.getAgencyVehicles(),
        agencyService.getAgencyBookings()
      ]);

      const nextAgency = profileResponse.data?.data?.agency;
      if (!nextAgency?._id) throw new Error('Agency profile could not be loaded.');

      setAgency(nextAgency);
      setStats(statsResponse.data?.data?.counts || null);
      setDrivers(driverResponse.data?.data?.drivers || []);
      setRequests(requestResponse.data?.data?.requests || []);
      setVehicles(vehicleResponse.data?.data?.vehicles || []);
      setBookings(bookingResponse.data?.data?.bookings || []);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch unread count & notifications
  const loadNotifications = useCallback(async () => {
    try {
      const [response, countResponse] = await Promise.all([
        notificationService.getNotifications({ page: 1, limit: 30 }),
        notificationService.getUnreadCount()
      ]);
      setNotifications(response.data?.data?.notifications || []);
      setUnreadCount(countResponse.data?.data?.count || 0);
    } catch {
      // Non-blocking for header badge
    }
  }, []);

  useEffect(() => {
    loadData();
    loadNotifications();
  }, [loadData, loadNotifications, refreshKey]);

  // Android hardware back handler
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const subTabs = ['Earnings', 'ProfileKyc', 'Notifications', 'Support'];
      if (subTabs.includes(activeTab)) {
        setActiveTab('More');
        return true;
      }
      if (activeTab !== 'Overview') {
        setActiveTab('Overview');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeTab]);

  const refresh = () => {
    setRefreshing(true);
    loadData(true);
    loadNotifications();
  };

  const runAction = async (key, action) => {
    if (saving) return;
    setSaving(key);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setSaving('');
    }
  };

  // Document Picker Utility
  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return null;
    const file = result.assets?.[0];
    if (!file) throw new Error('No document was selected.');
    if (file.size > 5 * 1024 * 1024) throw new Error('File size exceeds the 5 MB limit.');
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const mimeType = file.mimeType?.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.mimeType?.toLowerCase();
    if ((extension && !allowedExtensions.includes(extension)) || (mimeType && !allowedMimeTypes.includes(mimeType))) {
      throw new Error('Please upload a valid JPEG, PNG, WebP, or PDF file.');
    }
    return file;
  };

  // Document Upload Handlers
  const handleUploadAgencyDoc = async (docType, label) => {
    try {
      const file = await chooseFile();
      if (!file) return;
      if (!agency?._id) throw new Error('Agency identifier is missing.');
      await runAction(`agency-${docType}`, async () => {
        await agencyService.uploadAgencyDocument(agency._id, docType, file);
        setNotice(`${label || docType} uploaded successfully. Submitted for Super Admin verification.`);
        await loadData(true);
      });
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
  };

  const handleUploadVehicleDoc = async (vehicleId, docType) => {
    try {
      const file = await chooseFile();
      if (!file) return;
      await runAction(`vehicle-${vehicleId}-${docType}`, async () => {
        await agencyService.uploadVehicleDocument(vehicleId, docType, file);
        setNotice(`Vehicle document (${docType}) uploaded successfully. Submitted for Super Admin verification.`);
        await loadData(true);
      });
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
  };

  // Driver Request Handlers
  const handleAcceptRequest = async (driverId) => {
    await runAction(`accept-${driverId}`, async () => {
      await agencyService.acceptAgencyDriverRequest(driverId);
      setNotice('Driver joining request approved. Driver now awaits Super Admin KYC verification.');
      await loadData(true);
    });
  };

  const handleRejectRequest = async (driverId, reason) => {
    await runAction(`reject-${driverId}`, async () => {
      await agencyService.rejectAgencyDriverRequest(driverId, reason);
      setNotice('Driver joining request has been rejected.');
      await loadData(true);
    });
  };

  // Driver Registration Handler
  const handleRegisterDriver = async (driverData) => {
    await runAction('register-driver', async () => {
      await agencyService.createAgencyDriver(driverData);
      setNotice('New driver registered successfully. Driver can now submit KYC credentials.');
      setIsRegisterDriverOpen(false);
      await loadData(true);
    });
  };

  // Vehicle Management Handlers
  const handleCreateVehicle = async (vehicleData) => {
    await runAction('create-vehicle', async () => {
      await agencyService.createAgencyVehicle(vehicleData);
      setNotice('Vehicle registered successfully. Upload RC and Insurance documents.');
      setIsAddVehicleOpen(false);
      await loadData(true);
    });
  };

  const handleUpdateVehicle = async (vehicleId, vehicleData) => {
    await runAction(`update-vehicle-${vehicleId}`, async () => {
      await agencyService.updateAgencyVehicle(vehicleId, vehicleData);
      setNotice('Vehicle details updated successfully.');
      await loadData(true);
    });
  };

  const handleAssignDriver = async (vehicleId, driverId) => {
    await runAction(`assign-driver-${vehicleId}`, async () => {
      await agencyService.assignVehicleDriver(vehicleId, driverId);
      setNotice('Driver assigned to vehicle successfully.');
      await loadData(true);
    });
  };

  const handleUnassignDriver = async (vehicleId) => {
    await runAction(`unassign-driver-${vehicleId}`, async () => {
      await agencyService.unassignVehicleDriver(vehicleId);
      setNotice('Driver unassigned from vehicle.');
      await loadData(true);
    });
  };

  // Booking Assignment Handler
  const handleAssignBooking = async (bookingId, driverId, vehicleId) => {
    await runAction(`assign-booking-${bookingId}`, async () => {
      await agencyService.assignAgencyBooking(bookingId, driverId, vehicleId);
      setNotice('Driver and vehicle assigned to load booking. Driver notified.');
      await loadData(true);
    });
  };

  // Profile Update Handler
  const handleUpdateProfile = async (data) => {
    await runAction('profile', async () => {
      await agencyService.updateMyAgency(data);
      setNotice('Agency profile information updated successfully.');
      await loadData(true);
    });
  };

  // Notification Handlers
  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, read: true, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
      setUnreadCount(0);
      setNotice('All notifications marked as read.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // Count Badges for Bottom Nav
  const pendingRequestsCount = useMemo(() => {
    return requests.filter((r) => r.agencyAssociation?.status === 'pending').length;
  }, [requests]);

  const pendingBookingsCount = useMemo(() => {
    return bookings.filter((b) =>
      ['pending', 'created', 'requested', 'unassigned'].includes(b.status)
    ).length;
  }, [bookings]);

  const completedBookingsCount = useMemo(() => {
    return bookings.filter((b) => b.status === 'completed').length;
  }, [bookings]);

  const isSubTab = ['Earnings', 'ProfileKyc', 'Notifications', 'Support'].includes(activeTab);

  const getSubTabTitle = () => {
    switch (activeTab) {
      case 'Earnings':
        return 'Earnings & Volume';
      case 'ProfileKyc':
        return 'Agency Profile & KYC';
      case 'Notifications':
        return 'Notifications & Alerts';
      case 'Support':
        return 'Help & Support';
      default:
        return '';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.surface} />

      {/* TOP HEADER */}
      {isSubTab ? (
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveTab('More')}
            style={({ pressed }) => [styles.subHeaderBackBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.ink} />
            <Text style={styles.subHeaderBackText}>More</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>
            {getSubTabTitle()}
          </Text>
          <View style={{ width: 60 }} />
        </View>
      ) : (
        <AgencyHeader
          agency={agency}
          user={user}
          unreadCount={unreadCount}
          onOpenNotifications={() => setActiveTab('Notifications')}
          onOpenProfile={() => setActiveTab('ProfileKyc')}
        />
      )}

      {/* FLOATING SYSTEM TOAST BANNERS */}
      {notice ? (
        <ToastBanner
          type="success"
          message={notice}
          onDismiss={() => setNotice('')}
        />
      ) : null}

      {error ? (
        <ToastBanner
          type="error"
          message={error}
          onDismiss={() => setError('')}
          onRetry={() => loadData(true)}
        />
      ) : null}

      {/* MAIN VIEWPORT / TAB CONTENT */}
      <View style={styles.viewport}>
        {loading ? (
          <View style={{ padding: theme.spacing.md }}>
            <LoadingSkeleton count={4} />
          </View>
        ) : (
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                agency={agency}
                stats={stats}
                drivers={drivers}
                requests={requests}
                vehicles={vehicles}
                bookings={bookings}
                onNavigateTab={(tab) => {
                  if (tab === 'Fleet Vehicles') setActiveTab('Fleet');
                  else if (tab === 'Profile & KYC') setActiveTab('ProfileKyc');
                  else setActiveTab(tab);
                }}
                onOpenRegisterDriver={() => {
                  setActiveTab('Drivers');
                  setIsRegisterDriverOpen(true);
                }}
                onOpenAddVehicle={() => {
                  setActiveTab('Fleet');
                  setIsAddVehicleOpen(true);
                }}
                onOpenProfileKyc={() => setActiveTab('ProfileKyc')}
              />
            )}

            {activeTab === 'Drivers' && (
              <DriversTab
                drivers={drivers}
                requests={requests}
                vehicles={vehicles}
                stats={stats}
                saving={saving}
                onAcceptRequest={handleAcceptRequest}
                onRejectRequest={handleRejectRequest}
                onRegisterDriver={handleRegisterDriver}
                isRegisterModalOpen={isRegisterDriverOpen}
                onCloseRegisterModal={() => setIsRegisterDriverOpen(false)}
                onOpenRegisterModal={() => setIsRegisterDriverOpen(true)}
              />
            )}

            {activeTab === 'Fleet' && (
              <FleetTab
                vehicles={vehicles}
                drivers={drivers}
                saving={saving}
                onAddVehicle={handleCreateVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                onAssignDriver={handleAssignDriver}
                onUnassignDriver={handleUnassignDriver}
                onUploadVehicleDoc={handleUploadVehicleDoc}
                isAddModalOpen={isAddVehicleOpen}
                onCloseAddModal={() => setIsAddVehicleOpen(false)}
                onOpenAddModal={() => setIsAddVehicleOpen(true)}
              />
            )}

            {activeTab === 'Bookings' && (
              <BookingsTab
                bookings={bookings}
                drivers={drivers}
                vehicles={vehicles}
                saving={saving}
                onAssignBooking={handleAssignBooking}
              />
            )}

            {activeTab === 'More' && (
              <MoreTab
                agency={agency}
                user={user}
                unreadCount={unreadCount}
                completedBookingsCount={completedBookingsCount}
                onNavigateSection={(sectionId) => setActiveTab(sectionId)}
                onLogout={onLogout}
              />
            )}

            {activeTab === 'Earnings' && (
              <EarningsTab
                bookings={bookings}
                loading={loading}
                refreshing={refreshing}
                onRefresh={refresh}
                onSelectBooking={() => {}}
              />
            )}

            {activeTab === 'ProfileKyc' && (
              <ProfileKycTab
                agency={agency}
                user={user}
                saving={saving}
                loading={loading}
                refreshing={refreshing}
                onRefresh={refresh}
                onUpdateProfile={handleUpdateProfile}
                onUploadDocument={handleUploadAgencyDoc}
              />
            )}

            {activeTab === 'Notifications' && (
              <NotificationsTab
                notifications={notifications}
                unreadCount={unreadCount}
                loading={loading}
                refreshing={refreshing}
                onRefresh={refresh}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                onSelectNotification={(notif) => {
                  if (notif.data?.bookingId) setActiveTab('Bookings');
                  else if (notif.data?.driverId) setActiveTab('Drivers');
                }}
              />
            )}

            {activeTab === 'Support' && <SupportTab />}
          </>
        )}
      </View>

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <AgencyBottomNav
        activeTab={activeTab}
        onSelectTab={(tabId) => setActiveTab(tabId)}
        requestsCount={pendingRequestsCount}
        pendingBookingsCount={pendingBookingsCount}
        unreadNotificationsCount={unreadCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    ...(Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {})
  },
  viewport: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.bg
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  subHeaderBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8
  },
  subHeaderBackText: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold
  },
  subHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold
  }
});
