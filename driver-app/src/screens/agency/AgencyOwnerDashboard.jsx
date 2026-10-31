import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import agencyService from '../../services/agencyService';
import notificationService from '../../services/notificationService';

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
  warning: '#F59E0B'
};

const tabs = [
  'Overview',
  'Drivers',
  'Fleet Vehicles',
  'Bookings',
  'Earnings',
  'Profile & KYC',
  'Notifications',
  'Support'
];

const agencyDocumentTypes = [
  ['ownerAadhaar', 'Owner Aadhaar'],
  ['businessRegistration', 'Business Registration'],
  ['tradeLicense', 'Trade Licence'],
  ['gstCertificate', 'GST Certificate'],
  ['taxId', 'Tax ID / PAN']
];

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'The request could not be completed.';

const statusColor = (status) => {
  if (status === 'approved' || status === 'accepted') return colors.green;
  if (status === 'rejected' || status === 'suspended') return colors.danger;
  if (status === 'pending') return colors.warning;
  return colors.muted;
};

const prettyStatus = (status) => String(status || 'not_uploaded').replace(/_/g, ' ');
const kgCapacity = (vehicle) => {
  const capacity = Number(vehicle.loadCapacity?.value || 0);
  return vehicle.loadCapacity?.unit === 'ton' ? capacity * 1000 : capacity;
};

function Button({ title, onPress, secondary = false, danger = false, disabled = false, style }) {
  const color = danger ? colors.danger : secondary ? colors.surface : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[{
        backgroundColor: color,
        borderColor: danger ? colors.danger : secondary ? colors.border : colors.primary,
        borderWidth: 1,
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 9,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1
      }, style]}
    >
      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 12 }}>{title}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, secureTextEntry = false }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        style={{
          color: colors.ink,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 9,
          padding: 11,
          minHeight: multiline ? 74 : 42,
          textAlignVertical: multiline ? 'top' : 'center'
        }}
      />
    </View>
  );
}

function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 15,
      gap: 10
    }, style]}>
      {children}
    </View>
  );
}

function Status({ label, status, reason, submittedAt }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border, gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: colors.ink, fontWeight: '700', flex: 1 }}>{label}</Text>
        <Text style={{ color: statusColor(status), textTransform: 'capitalize', fontWeight: '800' }}>{prettyStatus(status)}</Text>
      </View>
      {submittedAt ? <Text style={{ color: colors.muted, fontSize: 11 }}>Submitted {new Date(submittedAt).toLocaleDateString()}</Text> : null}
      {reason ? <Text style={{ color: colors.danger, fontSize: 12 }}>Reason: {reason}</Text> : null}
    </View>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [requestReasons, setRequestReasons] = useState({});
  const [profileForm, setProfileForm] = useState({ agencyName: '', address: '', city: '' });
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    vehicleModel: '',
    vehicleType: '',
    capacity: '',
    capacityUnit: 'kg',
    bodyType: 'open'
  });
  const [newDriver, setNewDriver] = useState({ fullName: '', phone: '', email: '', password: '', address: '' });
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [bookingSelections, setBookingSelections] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [profileResponse, statsResponse, driverResponse, requestResponse, vehicleResponse, bookingResponse] =
        await Promise.all([
          agencyService.getMyAgency(),
          agencyService.getAgencyStats(),
          agencyService.getAgencyDrivers(),
          agencyService.getAgencyDriverRequests(),
          agencyService.getAgencyVehicles(),
          agencyService.getAgencyBookings()
        ]);
      const nextAgency = profileResponse.data?.data?.agency;
      if (!nextAgency?._id) throw new Error('The Agency profile was not returned by the service.');
      setAgency(nextAgency);
      setProfileForm({
        agencyName: nextAgency.agencyName || '',
        address: nextAgency.address || '',
        city: nextAgency.city || ''
      });
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

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showNotifications) {
        setShowNotifications(false);
        return true;
      }
      if (activeTab !== 'Overview') {
        setActiveTab('Overview');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeTab, showNotifications]);

  useEffect(() => {
    if (activeTab !== 'Notifications') return;
    let active = true;
    (async () => {
      try {
        const [response, countResponse] = await Promise.all([
          notificationService.getNotifications({ page: 1, limit: 30 }),
          notificationService.getUnreadCount()
        ]);
        if (!active) return;
        setNotifications(response.data?.data?.notifications || []);
        setUnreadCount(countResponse.data?.data?.count || 0);
        await notificationService.markAllAsRead();
        if (active) setUnreadCount(0);
      } catch (notificationError) {
        if (active) setError(errorMessage(notificationError));
      }
    })();
    return () => { active = false; };
  }, [activeTab]);

  const refresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const runAction = async (key, action) => {
    if (saving) return;
    setSaving(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice('Changes saved.');
      await loadData(true);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setSaving('');
    }
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return null;
    const file = result.assets?.[0];
    if (!file) throw new Error('The file picker did not return a document.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.');
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const mimeType = file.mimeType?.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.mimeType?.toLowerCase();
    if ((extension && !allowedExtensions.includes(extension)) || (mimeType && !allowedMimeTypes.includes(mimeType))) {
      throw new Error('Choose a JPEG, PNG, WebP, or PDF document.');
    }
    return file;
  };

  const uploadAgencyDocument = async (docType, label) => {
    try {
      const file = await chooseFile();
      if (file && agency?._id) await runAction(`agency-${docType}`, () => agencyService.uploadAgencyDocument(agency._id, docType, file));
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
  };

  const uploadVehicleDocument = async (vehicleId, docType) => {
    try {
      const file = await chooseFile();
      if (file) await runAction(`vehicle-${vehicleId}-${docType}`, () => agencyService.uploadVehicleDocument(vehicleId, docType, file));
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    }
  };

  const eligibleDrivers = useMemo(() => drivers.filter((driver) =>
    driver.isActive !== false &&
    driver.approvalStatus === 'approved' &&
    driver.agencyAssociation?.status === 'approved' &&
    driver.documents?.idProof?.status === 'approved' &&
    driver.documents?.drivingLicense?.status === 'approved'
  ), [drivers]);

  const eligibleVehicles = useMemo(() => vehicles.filter((vehicle) =>
    vehicle.isActive !== false &&
    vehicle.documents?.registration?.status === 'approved' &&
    vehicle.documents?.insurance?.status === 'approved'
  ), [vehicles]);

  const saveProfile = () => runAction('profile', () => agencyService.updateMyAgency(profileForm));

  const addVehicle = () => runAction('new-vehicle', async () => {
    const capacity = Number(vehicleForm.capacity);
    if (!vehicleForm.vehicleNumber.trim() || !vehicleForm.vehicleModel.trim() || !vehicleForm.vehicleType.trim() || !Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('Enter a vehicle number, model, type, and positive load capacity.');
    }
    await agencyService.createAgencyVehicle({
      vehicleNumber: vehicleForm.vehicleNumber.trim(),
      vehicleModel: vehicleForm.vehicleModel.trim(),
      vehicleType: vehicleForm.vehicleType.trim(),
      loadCapacity: { value: capacity, unit: vehicleForm.capacityUnit },
      bodyType: vehicleForm.bodyType.trim() || 'open'
    });
    setVehicleForm({ vehicleNumber: '', vehicleModel: '', vehicleType: '', capacity: '', capacityUnit: 'kg', bodyType: 'open' });
  });

  const addDriver = () => runAction('new-driver', async () => {
    if (!newDriver.fullName.trim() || !newDriver.phone.trim() || newDriver.password.length < 6) {
      throw new Error('Enter the driver name and phone number, and use a password of at least 6 characters.');
    }
    await agencyService.createAgencyDriver({
      fullName: newDriver.fullName.trim(),
      phone: newDriver.phone.trim(),
      email: newDriver.email.trim() || undefined,
      password: newDriver.password,
      address: newDriver.address.trim()
    });
    setNewDriver({ fullName: '', phone: '', email: '', password: '', address: '' });
  });

  const saveVehicleEdit = (vehicleId) => runAction(`vehicle-edit-${vehicleId}`, async () => {
    const capacity = Number(editingVehicle.capacity);
    if (!editingVehicle.vehicleModel.trim() || !Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('Enter a vehicle model and positive load capacity.');
    }
    await agencyService.updateAgencyVehicle(vehicleId, {
      vehicleModel: editingVehicle.vehicleModel.trim(),
      vehicleType: editingVehicle.vehicleType,
      loadCapacity: { value: capacity, unit: editingVehicle.capacityUnit },
      bodyType: editingVehicle.bodyType
    });
    setEditingVehicle(null);
  });

  const requestApproval = (request, accept) => {
    const driverId = request.id || request._id;
    if (accept) {
      runAction(`request-${driverId}`, () => agencyService.acceptAgencyDriverRequest(driverId));
      return;
    }
    const reason = requestReasons[driverId]?.trim();
    if (!reason) {
      setError('Enter a rejection reason before rejecting a joining request.');
      return;
    }
    runAction(`request-${driverId}`, () => agencyService.rejectAgencyDriverRequest(driverId, reason));
  };

  const requestNotificationAccess = async () => {
    try {
      const [response, countResponse] = await Promise.all([
        notificationService.getNotifications({ page: 1, limit: 30 }),
        notificationService.getUnreadCount()
      ]);
      setNotifications(response.data?.data?.notifications || []);
      setUnreadCount(countResponse.data?.data?.count || 0);
      await notificationService.markAllAsRead();
      setUnreadCount(0);
      setShowNotifications(true);
    } catch (notificationError) {
      setError(errorMessage(notificationError));
    }
  };

  const selectedTab = (name) => {
    setActiveTab(name);
    setError('');
    setNotice('');
    loadData(true);
  };

  const heading = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>LoadBalbin</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>{agency?.agencyName || user?.name || 'Agency Owner'}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={requestNotificationAccess} style={{ padding: 9, position: 'relative' }}>
          <Ionicons name="notifications-outline" size={23} color={colors.ink} />
          {unreadCount > 0 ? <View style={{ position: 'absolute', right: 2, top: 2, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => selectedTab(tab)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, backgroundColor: activeTab === tab ? colors.primary : colors.surface }}>
            <Text style={{ color: activeTab === tab ? '#FFFFFF' : colors.muted, fontSize: 11, fontWeight: '800' }}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  const profileTab = () => (
    <>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Agency profile</Text>
        <Text style={{ color: statusColor(agency?.approvalStatus), textTransform: 'capitalize', fontWeight: '800' }}>
          {prettyStatus(agency?.approvalStatus)}{agency?.isActive === false ? ' · inactive' : ''}
        </Text>
        {agency?.rejectionReason ? <Text style={{ color: colors.danger }}>Reason: {agency.rejectionReason}</Text> : null}
        <Field label="Agency name" value={profileForm.agencyName} onChangeText={(value) => setProfileForm((current) => ({ ...current, agencyName: value }))} />
        <Field label="Address" value={profileForm.address} onChangeText={(value) => setProfileForm((current) => ({ ...current, address: value }))} multiline />
        <Field label="City" value={profileForm.city} onChangeText={(value) => setProfileForm((current) => ({ ...current, city: value }))} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Registered contact: {agency?.phone || 'Not provided'} · {agency?.email || 'No email'}</Text>
        <Button title={saving === 'profile' ? 'Saving...' : 'Save profile'} onPress={saveProfile} disabled={Boolean(saving)} />
        <Button title="Sign out" secondary onPress={onLogout} />
      </Card>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>Agency KYC documents</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>These agency documents are reviewed separately from driver identity documents.</Text>
        {agencyDocumentTypes.map(([key, label]) => {
          const document = agency?.documents?.[key];
          return (
            <View key={key}>
              <Status label={label} status={document?.status} reason={document?.rejectionReason} submittedAt={document?.submittedAt} />
              {(!document?.status || document.status === 'not_uploaded' || document.status === 'rejected') ? (
                <Button
                  title={saving === `agency-${key}` ? 'Uploading...' : document?.status === 'rejected' ? 'Replace rejected document' : 'Upload document'}
                  onPress={() => uploadAgencyDocument(key, label)}
                  disabled={Boolean(saving)}
                  secondary
                  style={{ alignSelf: 'flex-start', marginTop: 7 }}
                />
              ) : null}
            </View>
          );
        })}
      </Card>
    </>
  );

  const overviewTab = () => (
    <>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Agency overview</Text>
        <Text style={{ color: statusColor(agency?.approvalStatus), textTransform: 'capitalize', fontWeight: '800' }}>
          Agency verification: {prettyStatus(agency?.approvalStatus)}
        </Text>
        {agency?.rejectionReason ? <Text style={{ color: colors.danger }}>Reason: {agency.rejectionReason}</Text> : null}
        <Text style={{ color: colors.muted, lineHeight: 18 }}>
          {agency?.approvalStatus === 'approved'
            ? 'Manage your agency drivers, approved fleet, and booking assignments.'
            : 'Agency management actions remain subject to Super Admin approval and server-side eligibility checks.'}
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Card style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Registered drivers</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{stats?.total ?? drivers.length}</Text></Card>
        <Card style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Joining requests</Text><Text style={{ color: colors.warning, fontSize: 22, fontWeight: '900' }}>{stats?.pendingAgency ?? requests.filter((item) => item.agencyAssociation?.status === 'pending').length}</Text></Card>
      </View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Card style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Fleet vehicles</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{vehicles.length}</Text></Card>
        <Card style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Bookings</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{bookings.length}</Text></Card>
      </View>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800' }}>Approval boundaries</Text>
        <Text style={{ color: colors.muted, lineHeight: 18 }}>Agency acceptance only approves a driver's agency association. Super Admin independently reviews driver Aadhaar, Driving Licence, and final account approval.</Text>
        <Text style={{ color: colors.muted, lineHeight: 18 }}>A booking assignment remains pending until the assigned driver accepts it in the Driver App.</Text>
      </Card>
    </>
  );

  const driversTab = () => (
    <>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Register an agency driver</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>The new Driver account remains pending Super Admin KYC and final approval. The driver signs in to upload their own Aadhaar and Driving Licence.</Text>
        <Field label="Full name" value={newDriver.fullName} onChangeText={(value) => setNewDriver((current) => ({ ...current, fullName: value }))} />
        <Field label="Phone number" value={newDriver.phone} onChangeText={(value) => setNewDriver((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <Field label="Email (optional)" value={newDriver.email} onChangeText={(value) => setNewDriver((current) => ({ ...current, email: value }))} keyboardType="email-address" />
        <Field label="Temporary password (minimum 6 characters)" value={newDriver.password} onChangeText={(value) => setNewDriver((current) => ({ ...current, password: value }))} secureTextEntry />
        <Field label="Address (optional)" value={newDriver.address} onChangeText={(value) => setNewDriver((current) => ({ ...current, address: value }))} multiline />
        <Button title={saving === 'new-driver' ? 'Registering...' : 'Register driver'} onPress={addDriver} disabled={Boolean(saving)} />
      </Card>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Driver joining requests</Text>
        {requests.length === 0 ? <Text style={{ color: colors.muted }}>No driver joining requests.</Text> : null}
        {requests.map((request) => {
          const id = request.id || request._id;
          const association = request.agencyAssociation?.status || 'pending';
          return (
            <View key={id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 11, gap: 7 }}>
              <Text style={{ color: colors.ink, fontWeight: '800' }}>{request.fullName || 'Driver'}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{request.phone || ''} {request.email ? `· ${request.email}` : ''}</Text>
              <Text style={{ color: statusColor(association), textTransform: 'capitalize', fontWeight: '700' }}>Agency request: {prettyStatus(association)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Driver account: {prettyStatus(request.approvalStatus)} · Aadhaar: {prettyStatus(request.documents?.idProof?.status)} · DL: {prettyStatus(request.documents?.drivingLicense?.status)}</Text>
              {request.agencyAssociation?.rejectionReason ? <Text style={{ color: colors.danger }}>Reason: {request.agencyAssociation.rejectionReason}</Text> : null}
              {association === 'pending' ? (
                <>
                  <Field label="Rejection reason (required to reject)" value={requestReasons[id] || ''} onChangeText={(value) => setRequestReasons((current) => ({ ...current, [id]: value }))} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Accept request" onPress={() => requestApproval(request, true)} disabled={Boolean(saving)} style={{ flex: 1 }} />
                    <Button title="Reject request" danger onPress={() => requestApproval(request, false)} disabled={Boolean(saving)} style={{ flex: 1 }} />
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Agency drivers</Text>
        {drivers.length === 0 ? <Text style={{ color: colors.muted }}>No agency drivers registered yet.</Text> : null}
        {drivers.map((driver) => (
          <View key={driver._id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 11, gap: 5 }}>
            <Text style={{ color: colors.ink, fontWeight: '800' }}>{driver.fullName || driver.user?.name || 'Driver'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{driver.phone || driver.user?.phone || ''} · Association: {prettyStatus(driver.agencyAssociation?.status)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Aadhaar: {prettyStatus(driver.documents?.idProof?.status)} · Driving Licence: {prettyStatus(driver.documents?.drivingLicense?.status)}</Text>
            <Text style={{ color: statusColor(driver.approvalStatus), fontWeight: '700', fontSize: 12 }}>Final Super Admin approval: {prettyStatus(driver.approvalStatus)}</Text>
            {driver.assignedVehicle ? <Text style={{ color: colors.muted, fontSize: 12 }}>Vehicle: {driver.assignedVehicle.vehicleNumber || driver.assignedVehicle.vehicleModel}</Text> : null}
          </View>
        ))}
      </Card>
    </>
  );

  const vehiclesTab = () => (
    <>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Add fleet vehicle</Text>
        <Field label="Vehicle number" value={vehicleForm.vehicleNumber} onChangeText={(value) => setVehicleForm((current) => ({ ...current, vehicleNumber: value }))} />
        <Field label="Model" value={vehicleForm.vehicleModel} onChangeText={(value) => setVehicleForm((current) => ({ ...current, vehicleModel: value }))} />
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>Vehicle type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => (
            <Button key={type} title={type} secondary={vehicleForm.vehicleType !== type} onPress={() => setVehicleForm((current) => ({ ...current, vehicleType: type }))} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Load capacity" value={vehicleForm.capacity} onChangeText={(value) => setVehicleForm((current) => ({ ...current, capacity: value }))} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            {['kg', 'ton'].map((unit) => <Button key={unit} title={unit} secondary={vehicleForm.capacityUnit !== unit} onPress={() => setVehicleForm((current) => ({ ...current, capacityUnit: unit }))} style={{ flex: 1 }} />)}
          </View>
        </View>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>Body type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {['open', 'closed', 'container', 'flatbed'].map((type) => (
            <Button key={type} title={type} secondary={vehicleForm.bodyType !== type} onPress={() => setVehicleForm((current) => ({ ...current, bodyType: type }))} />
          ))}
        </View>
        <Button title={saving === 'new-vehicle' ? 'Adding...' : 'Add vehicle'} onPress={addVehicle} disabled={Boolean(saving)} />
      </Card>
      {vehicles.length === 0 ? <Card><Text style={{ color: colors.muted }}>No fleet vehicles registered.</Text></Card> : null}
      {vehicles.map((vehicle) => {
        const availableDrivers = eligibleDrivers.filter((driver) => {
          const alreadyAssigned = vehicles.some((item) => String(item.driver?._id || item.driver) === String(driver._id));
          return !alreadyAssigned || String(vehicle.driver?._id || vehicle.driver) === String(driver._id);
        });
        const dispatchReady = vehicle.isActive !== false &&
          vehicle.documents?.registration?.status === 'approved' &&
          vehicle.documents?.insurance?.status === 'approved';
        return (
          <Card key={vehicle._id}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{vehicle.vehicleNumber} · {vehicle.vehicleModel}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{vehicle.vehicleType} · Capacity {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit} · {vehicle.isActive === false ? 'inactive' : 'active'}</Text>
            {editingVehicle?.id === vehicle._id ? (
              <>
                <Field label="Vehicle model" value={editingVehicle.vehicleModel} onChangeText={(value) => setEditingVehicle((current) => ({ ...current, vehicleModel: value }))} />
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>Vehicle type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => (
                    <Button key={type} title={type} secondary={editingVehicle.vehicleType !== type} onPress={() => setEditingVehicle((current) => ({ ...current, vehicleType: type }))} />
                  ))}
                </View>
                <Field label="Load capacity" value={editingVehicle.capacity} onChangeText={(value) => setEditingVehicle((current) => ({ ...current, capacity: value }))} keyboardType="decimal-pad" />
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  {['kg', 'ton'].map((unit) => <Button key={unit} title={unit} secondary={editingVehicle.capacityUnit !== unit} onPress={() => setEditingVehicle((current) => ({ ...current, capacityUnit: unit }))} />)}
                </View>
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>Body type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {['open', 'closed', 'container', 'flatbed'].map((type) => (
                    <Button key={type} title={type} secondary={editingVehicle.bodyType !== type} onPress={() => setEditingVehicle((current) => ({ ...current, bodyType: type }))} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Save vehicle changes" onPress={() => saveVehicleEdit(vehicle._id)} disabled={Boolean(saving)} style={{ flex: 1 }} />
                  <Button title="Cancel" secondary onPress={() => setEditingVehicle(null)} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Button
                title="Edit vehicle"
                secondary
                onPress={() => setEditingVehicle({
                  id: vehicle._id,
                  vehicleModel: vehicle.vehicleModel || '',
                  vehicleType: vehicle.vehicleType || 'mini-truck',
                  capacity: String(vehicle.loadCapacity?.value || ''),
                  capacityUnit: vehicle.loadCapacity?.unit || 'kg',
                  bodyType: vehicle.bodyType || 'open'
                })}
              />
            )}
            <Status label="Registration Certificate (RC)" status={vehicle.documents?.registration?.status} reason={vehicle.documents?.registration?.rejectionReason} submittedAt={vehicle.documents?.registration?.submittedAt} />
            {(!vehicle.documents?.registration?.status || ['not_uploaded', 'rejected'].includes(vehicle.documents?.registration?.status)) ? (
              <Button title="Upload / replace RC" secondary onPress={() => uploadVehicleDocument(vehicle._id, 'registration')} disabled={Boolean(saving)} />
            ) : null}
            <Status label="Insurance" status={vehicle.documents?.insurance?.status} reason={vehicle.documents?.insurance?.rejectionReason} submittedAt={vehicle.documents?.insurance?.submittedAt} />
            {(!vehicle.documents?.insurance?.status || ['not_uploaded', 'rejected'].includes(vehicle.documents?.insurance?.status)) ? (
              <Button title="Upload / replace Insurance" secondary onPress={() => uploadVehicleDocument(vehicle._id, 'insurance')} disabled={Boolean(saving)} />
            ) : null}
            <Text style={{ color: colors.muted, fontSize: 12 }}>Assigned driver: {vehicle.driver?.fullName || vehicle.driver?.name || 'None'}</Text>
            {availableDrivers.map((driver) => (
              <Button
                key={driver._id}
                title={`Assign ${driver.fullName || driver.user?.name || 'driver'}`}
                secondary
                disabled={Boolean(saving) || !dispatchReady}
                onPress={() => runAction(`vehicle-driver-${vehicle._id}`, () => agencyService.assignVehicleDriver(vehicle._id, driver._id))}
              />
            ))}
            {vehicle.driver ? <Button title="Unassign driver" danger disabled={Boolean(saving)} onPress={() => runAction(`vehicle-unassign-${vehicle._id}`, () => agencyService.unassignVehicleDriver(vehicle._id))} /> : null}
            <Button
              title={vehicle.isActive === false ? 'Activate vehicle' : 'Deactivate vehicle'}
              secondary
              disabled={Boolean(saving)}
              onPress={() => runAction(`vehicle-active-${vehicle._id}`, () => agencyService.updateAgencyVehicle(vehicle._id, { isActive: vehicle.isActive === false }))}
            />
          </Card>
        );
      })}
    </>
  );

  const bookingTab = () => (
    <>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Agency bookings</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Assignments remain pending until the assigned driver responds in the Driver App.</Text>
      </Card>
      {bookings.length === 0 ? <Card><Text style={{ color: colors.muted }}>No agency bookings.</Text></Card> : null}
      {bookings.map((booking) => {
        const bookingId = booking._id;
        const rejectedOrUnassigned = !booking.driver && ['unassigned', 'rejected', undefined].includes(booking.assignmentStatus);
        const candidates = eligibleDrivers.flatMap((driver) => eligibleVehicles
          .filter((vehicle) =>
            String(vehicle.driver?._id || vehicle.driver) === String(driver._id) &&
            vehicle.isAvailable &&
            vehicle.vehicleType === booking.vehicleType &&
            kgCapacity(vehicle) >= (booking.weight?.unit === 'ton'
              ? Number(booking.weight?.value || 0) * 1000
              : Number(booking.weight?.value || 0))
          )
          .map((vehicle) => ({ driver, vehicle })));
        const selection = bookingSelections[bookingId] || {};
        return (
          <Card key={bookingId}>
            <Text style={{ color: colors.teal, fontWeight: '800' }}>#{booking.bookingId || bookingId}</Text>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>{booking.pickup?.address || 'Pickup'} to {booking.drop?.address || 'Drop'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{booking.vehicleType || 'Vehicle'} · {booking.weight?.value || 0} {booking.weight?.unit || 'kg'} · {booking.bookingStatus}</Text>
            <Text style={{ color: statusColor(booking.assignmentStatus), textTransform: 'capitalize', fontWeight: '700' }}>
              Driver response: {prettyStatus(booking.assignmentStatus || booking.bookingStatus)}
            </Text>
            {booking.rejectedReason ? <Text style={{ color: colors.warning }}>Driver response: {booking.rejectedReason}</Text> : null}
            {booking.driver ? <Text style={{ color: colors.muted }}>Assigned driver: {booking.driver.fullName || booking.driver.name || 'Driver'} · Vehicle: {booking.vehicle?.vehicleNumber || 'Assigned'}</Text> : null}
            {rejectedOrUnassigned && booking.bookingStatus === 'pending' ? (
              candidates.length ? (
                <>
                  <Text style={{ color: colors.ink, fontWeight: '700', marginTop: 5 }}>Choose eligible driver and vehicle</Text>
                  {candidates.map(({ driver, vehicle }) => {
                    const selected = selection.driverId === driver._id && selection.vehicleId === vehicle._id;
                    return (
                      <Pressable
                        key={`${driver._id}-${vehicle._id}`}
                        onPress={() => setBookingSelections((current) => ({ ...current, [bookingId]: { driverId: driver._id, vehicleId: vehicle._id } }))}
                        style={{ backgroundColor: selected ? '#0E4B69' : colors.surface, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                      >
                        <Text style={{ color: colors.ink, fontWeight: '700' }}>{driver.fullName || driver.user?.name} · {vehicle.vehicleNumber}</Text>
                      </Pressable>
                    );
                  })}
                  <Button
                    title={saving === `booking-${bookingId}` ? 'Assigning...' : 'Assign and request driver response'}
                    disabled={Boolean(saving) || !selection.driverId || !selection.vehicleId}
                    onPress={() => runAction(`booking-${bookingId}`, () => agencyService.assignAgencyBooking(bookingId, selection.driverId, selection.vehicleId))}
                  />
                </>
              ) : <Text style={{ color: colors.muted }}>No approved, compatible driver and vehicle are currently eligible for this booking.</Text>
            ) : null}
          </Card>
        );
      })}
    </>
  );

  const earningsTab = () => {
    const completed = bookings.filter((booking) => booking.bookingStatus === 'completed');
    const gross = completed.reduce((total, booking) => total + Number(booking.finalFare || booking.estimatedFare || 0), 0);
    return (
      <>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Earnings overview</Text>
          <Text style={{ color: colors.muted, lineHeight: 18 }}>The Agency API does not expose a payout ledger. This is completed booking value only and is not a payout or settlement balance.</Text>
          <Text style={{ color: colors.primary, fontSize: 26, fontWeight: '900' }}>₹{gross.toLocaleString('en-IN')}</Text>
          <Text style={{ color: colors.muted }}>{completed.length} completed booking{completed.length === 1 ? '' : 's'} in the loaded booking history</Text>
        </Card>
        {completed.map((booking) => (
          <Card key={booking._id}>
            <Text style={{ color: colors.ink, fontWeight: '800' }}>#{booking.bookingId || booking._id}</Text>
            <Text style={{ color: colors.muted }}>{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : ''}</Text>
            <Text style={{ color: colors.teal, fontWeight: '800' }}>₹{booking.finalFare || booking.estimatedFare || 0}</Text>
          </Card>
        ))}
      </>
    );
  };

  const supportTab = () => (
    <Card>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Agency support</Text>
      <Text style={{ color: colors.muted, lineHeight: 19 }}>For help with agency verification, fleet eligibility, or booking assignments, contact LoadBalbin Support.</Text>
      <Button title="Email help@loadbalbin.com" onPress={() => Linking.openURL('mailto:help@loadbalbin.com?subject=Agency%20Support').catch((linkError) => setError(errorMessage(linkError)))} />
      <Button title="Sign out" secondary onPress={onLogout} />
    </Card>
  );

  const tabContent = () => {
    if (activeTab === 'Overview') return overviewTab();
    if (activeTab === 'Drivers') return driversTab();
    if (activeTab === 'Fleet Vehicles') return vehiclesTab();
    if (activeTab === 'Bookings') return bookingTab();
    if (activeTab === 'Earnings') return earningsTab();
    if (activeTab === 'Profile & KYC') return profileTab();
    if (activeTab === 'Notifications') return (
      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>Notifications</Text>
        {notifications.length === 0 ? <Text style={{ color: colors.muted }}>No notifications.</Text> : notifications.map((item) => (
          <View key={item._id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 9, gap: 4 }}>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: colors.muted }}>{item.message}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text>
          </View>
        ))}
      </Card>
    );
    return supportTab();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {heading}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, paddingHorizontal: 16, paddingVertical: 7 }}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="status" style={{ color: colors.teal, paddingHorizontal: 16, paddingVertical: 7 }}>{notice}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {!agency && !loading ? (
          <Card>
            <Text style={{ color: colors.ink, fontWeight: '800' }}>Agency profile unavailable</Text>
            <Text style={{ color: colors.muted }}>The authenticated account does not have an Agency profile. Contact support; do not create another account.</Text>
          </Card>
        ) : tabContent()}
      </ScrollView>
      <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>Notifications</Text>
            <Pressable accessibilityRole="button" onPress={() => setShowNotifications(false)}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
            {notifications.length === 0 ? <Text style={{ color: colors.muted }}>No notifications.</Text> : notifications.map((item) => (
              <Card key={item._id}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: colors.muted }}>{item.message}</Text>
              </Card>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
