import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ConfirmationModal from '../components/ConfirmationModal';
import agencyService from '../../../services/agencyService';

export default function DriversTab({
  drivers = [],
  requests = [],
  vehicles = [],
  stats,
  saving,
  onAcceptRequest,
  onRejectRequest,
  onRegisterDriver,
  isRegisterModalOpen = false,
  onCloseRegisterModal,
  onOpenRegisterModal
}) {
  const [activeSegment, setActiveSegment] = useState('roster'); // 'roster' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'verified' | 'pending'
  const [requestFilter, setRequestFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  // Modals state
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewRefreshAttempted, setPreviewRefreshAttempted] = useState(false);
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const previewRequestId = useRef(0);
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    type: '', // 'accept' | 'reject'
    request: null,
    reason: ''
  });

  // Register Driver Form state
  const [regForm, setRegForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    address: ''
  });
  const [regError, setRegError] = useState('');

  const loadDriverDocument = async (target) => {
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const response = await agencyService.getDriverDocument(target.driverId, target.docType);
      const document = response.data?.data?.document;
      if (!document?.viewUrl) {
        throw new Error('The secure document preview was not returned.');
      }

      let hostname = '';
      try {
        hostname = new URL(document.viewUrl).hostname;
      } catch {
        const match = String(document.viewUrl).match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
        hostname = match ? match[1] : '';
      }
      const isCloudinary = hostname === 'cloudinary.com' || hostname.endsWith('.cloudinary.com');
      const isLocalOrTest = (typeof __DEV__ !== 'undefined' && __DEV__) || hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isCloudinary && !isLocalOrTest) {
        throw new Error('The secure document service returned an unsupported preview link.');
      }

      if (previewRequestId.current === requestId) {
        const detectedFormat = (document.format || target.format || (document.viewUrl.split('?')[0].split('.').pop()) || '').toLowerCase().replace(/^\./, '');
        setPreviewDocument({
          ...target,
          viewUrl: document.viewUrl,
          status: document.status || target.status,
          rejectionReason: document.rejectionReason || target.rejectionReason,
          format: detectedFormat
        });
      }
    } catch (error) {
      if (previewRequestId.current === requestId) {
        setPreviewError(
          error?.response?.data?.message ||
          error?.message ||
          'The document could not be loaded. Please try again.'
        );
      }
    } finally {
      if (previewRequestId.current === requestId) setPreviewLoading(false);
    }
  };

  const openDriverDocument = (driver, docType, label) => {
    const document = driver.documents?.[docType] || {};
    const target = {
      driverId: driver._id,
      driverName: driver.fullName || driver.user?.name || 'Driver',
      docType,
      label,
      status: document.status || 'not_uploaded',
      rejectionReason: document.rejectionReason || '',
      format: document.format || ''
    };
    setPreviewDocument(target);
    setPreviewRefreshAttempted(false);
    setPreviewZoomed(false);
    loadDriverDocument(target);
  };

  const closeDocumentPreview = () => {
    previewRequestId.current += 1;
    setPreviewDocument(null);
    setPreviewError('');
    setPreviewLoading(false);
    setPreviewRefreshAttempted(false);
    setPreviewZoomed(false);
  };

  const refreshDocumentPreview = () => {
    if (!previewDocument) return;
    setPreviewRefreshAttempted(false);
    loadDriverDocument(previewDocument);
  };

  const handleImagePreviewError = () => {
    if (previewRefreshAttempted || !previewDocument) {
      setPreviewError('The secure image preview could not be loaded. Please retry.');
      return;
    }
    setPreviewRefreshAttempted(true);
    loadDriverDocument(previewDocument);
  };

  const openPdfPreview = async () => {
    try {
      await Linking.openURL(previewDocument.viewUrl);
      setPreviewError('');
    } catch {
      setPreviewError('The PDF could not be opened in a secure browser. Refresh the link and try again.');
    }
  };

  // Filtered Roster
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const name = (driver.fullName || driver.user?.name || '').toLowerCase();
      const phone = (driver.phone || driver.user?.phone || '');
      const matchesSearch = name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);

      if (!matchesSearch) return false;
      if (statusFilter === 'verified') return driver.approvalStatus === 'approved';
      if (statusFilter === 'pending') return driver.approvalStatus === 'pending';
      return true;
    });
  }, [drivers, searchQuery, statusFilter]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const status = req.agencyAssociation?.status || 'pending';
      if (requestFilter === 'all') return true;
      return status === requestFilter;
    });
  }, [requests, requestFilter]);

  const pendingRequestsCount = requests.filter(
    (r) => (r.agencyAssociation?.status || 'pending') === 'pending'
  ).length;

  const handleOpenConfirm = (request, type) => {
    setConfirmModal({
      visible: true,
      type,
      request,
      reason: ''
    });
  };

  const handleConfirmAction = async () => {
    const { type, request, reason } = confirmModal;
    if (!request) return;
    const driverId = request.id || request._id;

    if (type === 'accept') {
      await onAcceptRequest(driverId);
    } else if (type === 'reject') {
      await onRejectRequest(driverId, reason);
    }

    setConfirmModal({ visible: false, type: '', request: null, reason: '' });
  };

  const handleSubmitRegister = async () => {
    if (!regForm.fullName.trim() || !regForm.phone.trim() || regForm.password.length < 6) {
      setRegError('Driver name and phone number are required, and password must be at least 6 characters.');
      return;
    }
    setRegError('');
    try {
      await onRegisterDriver({
        fullName: regForm.fullName.trim(),
        phone: regForm.phone.trim(),
        email: regForm.email.trim() || undefined,
        password: regForm.password,
        address: regForm.address.trim()
      });
      setRegForm({ fullName: '', phone: '', email: '', password: '', address: '' });
      if (onCloseRegisterModal) onCloseRegisterModal();
    } catch (err) {
      setRegError(err?.message || 'Failed to register driver.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. TOP SEGMENTED CONTROL */}
      <View style={styles.segmentContainer}>
        <Pressable
          onPress={() => setActiveSegment('roster')}
          style={[styles.segmentBtn, activeSegment === 'roster' && styles.segmentBtnActive]}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeSegment === 'roster' ? '#FFFFFF' : theme.colors.muted}
          />
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'roster' && styles.segmentTextActive
            ]}
          >
            Driver Roster ({drivers.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveSegment('requests')}
          style={[styles.segmentBtn, activeSegment === 'requests' && styles.segmentBtnActive]}
        >
          <Ionicons
            name="git-pull-request"
            size={16}
            color={activeSegment === 'requests' ? '#FFFFFF' : theme.colors.muted}
          />
          <Text
            style={[
              styles.segmentText,
              activeSegment === 'requests' && styles.segmentTextActive
            ]}
          >
            Joining Requests
          </Text>
          {pendingRequestsCount > 0 ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingRequestsCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* 2. ACTIONS & FILTERS HEADER */}
      {activeSegment === 'roster' ? (
        <View style={styles.rosterHeader}>
          {/* Search bar */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search driver by name or phone..."
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Filter chips & Add Driver button */}
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['all', 'verified', 'pending'].map((filterKey) => {
                const isSelected = statusFilter === filterKey;
                const label = filterKey === 'all' ? 'All Drivers' : filterKey === 'verified' ? 'Verified' : 'Pending KYC';
                return (
                  <Pressable
                    key={filterKey}
                    onPress={() => setStatusFilter(filterKey)}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={onOpenRegisterModal}
              style={styles.addDriverBtn}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addDriverText}>Add Driver</Text>
            </Pressable>
          </View>

          {/* DRIVER LIST */}
          {filteredDrivers.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No Drivers Found"
              description={searchQuery ? 'Try matching a different driver name or phone number.' : 'Register your first agency driver to begin assigning vehicles.'}
              actionLabel={searchQuery ? 'Clear Search' : 'Register Driver'}
              onAction={searchQuery ? () => setSearchQuery('') : onOpenRegisterModal}
            />
          ) : (
            filteredDrivers.map((driver) => {
              const driverName = driver.fullName || driver.user?.name || 'Driver';
              const phone = driver.phone || driver.user?.phone || '';
              const idProof = driver.documents?.idProof?.status || 'not_uploaded';
              const dlProof = driver.documents?.drivingLicense?.status || 'not_uploaded';
              const assignedVehicle = vehicles.find((v) => String(v.driver?._id || v.driver) === String(driver._id));

              return (
                <View key={driver._id} style={styles.driverCard}>
                  <View style={styles.driverCardTop}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>
                        {driverName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
                      <Pressable
                        onPress={() => phone && Linking.openURL(`tel:${phone}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Ionicons name="call-outline" size={13} color={theme.colors.primary} />
                        <Text style={styles.driverPhone}>{phone || 'No phone'}</Text>
                      </Pressable>
                    </View>

                    <StatusBadge
                      status={driver.approvalStatus}
                      label={driver.approvalStatus === 'approved' ? 'Verified' : 'Pending Super Admin'}
                      size="sm"
                    />
                  </View>

                  <View style={styles.docSummaryRow}>
                    <View style={styles.docItem}>
                      <Text style={styles.docItemLabel}>Aadhaar:</Text>
                      <StatusBadge status={idProof} size="sm" />
                    </View>
                    <View style={styles.docItem}>
                      <Text style={styles.docItemLabel}>Driving Licence:</Text>
                      <StatusBadge status={dlProof} size="sm" />
                    </View>
                  </View>

                  <View style={styles.driverCardBottom}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name="bus-outline"
                        size={15}
                        color={assignedVehicle ? theme.colors.green : theme.colors.muted}
                      />
                      <Text style={[styles.vehicleNote, assignedVehicle && { color: theme.colors.ink }]}>
                        {assignedVehicle ? `${assignedVehicle.vehicleNumber} (${assignedVehicle.vehicleModel})` : 'No vehicle assigned'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setSelectedDriver(driver)}
                      style={styles.detailsBtn}
                    >
                      <Text style={styles.detailsBtnText}>Details</Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : (
        /* JOINING REQUESTS SEGMENT */
        <View style={styles.requestsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {[
              { id: 'pending', label: `Pending (${pendingRequestsCount})` },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'all', label: 'All Requests' }
            ].map((tab) => {
              const isSelected = requestFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setRequestFilter(tab.id)}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredRequests.length === 0 ? (
            <EmptyState
              icon="git-pull-request-outline"
              title="No Joining Requests"
              description={`There are no ${requestFilter === 'all' ? '' : requestFilter} driver association requests for your agency.`}
            />
          ) : (
            filteredRequests.map((request) => {
              const id = request.id || request._id;
              const association = request.agencyAssociation?.status || 'pending';
              const isPending = association === 'pending';
              const name = request.fullName || 'Driver';
              const phone = request.phone || '';
              const aadhaarStatus = request.documents?.idProof?.status || 'not_uploaded';
              const dlStatus = request.documents?.drivingLicense?.status || 'not_uploaded';

              return (
                <View key={id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestName}>{name}</Text>
                      <Text style={styles.requestContact}>{phone} {request.email ? `· ${request.email}` : ''}</Text>
                    </View>
                    <StatusBadge status={association} label={`Request: ${association}`} />
                  </View>

                  <View style={styles.requestKycGrid}>
                    <View style={styles.requestKycCell}>
                      <Text style={styles.kycCellTitle}>Driver Account</Text>
                      <StatusBadge status={request.approvalStatus} size="sm" />
                    </View>
                    <View style={styles.requestKycCell}>
                      <Text style={styles.kycCellTitle}>Aadhaar KYC</Text>
                      <StatusBadge status={aadhaarStatus} size="sm" />
                    </View>
                    <View style={styles.requestKycCell}>
                      <Text style={styles.kycCellTitle}>Driving Licence</Text>
                      <StatusBadge status={dlStatus} size="sm" />
                    </View>
                  </View>

                  {request.agencyAssociation?.rejectionReason ? (
                    <View style={styles.rejectionNotice}>
                      <Ionicons name="alert-circle" size={14} color={theme.colors.danger} />
                      <Text style={styles.rejectionNoticeText}>
                        Rejection reason: {request.agencyAssociation.rejectionReason}
                      </Text>
                    </View>
                  ) : null}

                  {isPending ? (
                    <View style={styles.requestActionsRow}>
                      <Pressable
                        onPress={() => handleOpenConfirm(request, 'reject')}
                        disabled={Boolean(saving)}
                        style={[styles.reqActionBtn, styles.rejectBtn]}
                      >
                        <Ionicons name="close" size={16} color={theme.colors.danger} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleOpenConfirm(request, 'accept')}
                        disabled={Boolean(saving)}
                        style={[styles.reqActionBtn, styles.acceptBtn]}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.acceptBtnText}>Approve Joining</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* 3. CONFIRMATION MODAL (ACCEPT / REJECT) */}
      <ConfirmationModal
        visible={confirmModal.visible}
        onClose={() => setConfirmModal({ visible: false, type: '', request: null, reason: '' })}
        onConfirm={handleConfirmAction}
        title={confirmModal.type === 'accept' ? 'Approve Driver Association' : 'Reject Driver Joining Request'}
        message={
          confirmModal.type === 'accept'
            ? `Are you sure you want to approve ${confirmModal.request?.fullName || 'this driver'} for your agency? Note: Driver will still require independent KYC verification by the Super Admin.`
            : `Are you sure you want to reject the association request from ${confirmModal.request?.fullName || 'this driver'}? You must provide a rejection reason.`
        }
        confirmLabel={confirmModal.type === 'accept' ? 'Approve Driver' : 'Confirm Rejection'}
        danger={confirmModal.type === 'reject'}
        inputLabel={confirmModal.type === 'reject' ? 'Rejection Reason (Mandatory)' : null}
        inputValue={confirmModal.reason}
        onInputChange={(val) => setConfirmModal((prev) => ({ ...prev, reason: val }))}
        inputPlaceholder="e.g. Document mismatch, incomplete agency criteria..."
        inputRequired={confirmModal.type === 'reject'}
        loading={Boolean(saving)}
      />

      {/* 4. REGISTER DRIVER MODAL */}
      <Modal
        visible={isRegisterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={onCloseRegisterModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onCloseRegisterModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Register Agency Driver</Text>
                <Text style={styles.modalSubtitle}>Create a new driver account linked to your agency</Text>
              </View>
              <Pressable onPress={onCloseRegisterModal} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {regError ? (
              <View style={styles.regErrorBanner}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={styles.regErrorText}>{regError}</Text>
              </View>
            ) : null}

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  value={regForm.fullName}
                  onChangeText={(val) => setRegForm((p) => ({ ...p, fullName: val }))}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  value={regForm.phone}
                  onChangeText={(val) => setRegForm((p) => ({ ...p, phone: val }))}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="phone-pad"
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address (Optional)</Text>
                <TextInput
                  value={regForm.email}
                  onChangeText={(val) => setRegForm((p) => ({ ...p, email: val }))}
                  placeholder="e.g. rajesh@gmail.com"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="email-address"
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Temporary Password * (Min 6 chars)</Text>
                <TextInput
                  value={regForm.password}
                  onChangeText={(val) => setRegForm((p) => ({ ...p, password: val }))}
                  placeholder="Enter password for driver login"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Residential Address (Optional)</Text>
                <TextInput
                  value={regForm.address}
                  onChangeText={(val) => setRegForm((p) => ({ ...p, address: val }))}
                  placeholder="Street address, city"
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  style={[styles.modalInput, { minHeight: 60 }]}
                />
              </View>

              <View style={styles.superAdminNotice}>
                <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
                <Text style={styles.superAdminNoticeText}>
                  After registration, the driver must sign in to the Driver App to upload their Aadhaar and Driving Licence. Final dispatch requires Super Admin approval.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={onCloseRegisterModal}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSubmitRegister}
                  disabled={saving === 'new-driver'}
                  style={styles.modalSubmitBtn}
                >
                  {saving === 'new-driver' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Register Driver</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. DRIVER DETAILS MODAL */}
      <Modal
        visible={Boolean(selectedDriver)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDriver(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectedDriver(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Driver Profile</Text>
              <Pressable onPress={() => setSelectedDriver(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {selectedDriver ? (
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                <View style={styles.detailCard}>
                  <Text style={styles.detailName}>{selectedDriver.fullName || selectedDriver.user?.name}</Text>
                  <Text style={styles.detailContact}>{selectedDriver.phone || selectedDriver.user?.phone}</Text>
                  {selectedDriver.email ? <Text style={styles.detailContact}>{selectedDriver.email}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <StatusBadge
                      status={selectedDriver.approvalStatus}
                      label={`Super Admin: ${selectedDriver.approvalStatus}`}
                    />
                    <StatusBadge
                      status={selectedDriver.agencyAssociation?.status || 'approved'}
                      label={`Agency: ${selectedDriver.agencyAssociation?.status || 'approved'}`}
                    />
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>KYC Verification Status</Text>
                  {[
                    { type: 'idProof', label: 'Aadhaar / ID Proof' },
                    { type: 'drivingLicense', label: 'Driving Licence' }
                  ].map(({ type, label }) => {
                    const document = selectedDriver.documents?.[type] || {};
                    const status = document.status || 'not_uploaded';
                    const uploaded = ['pending', 'approved', 'rejected'].includes(status);
                    return (
                      <View key={type} style={styles.kycDocumentRow}>
                        <View style={styles.kycDocumentHeader}>
                          <View style={styles.kycDocumentTitleWrap}>
                            <Text style={styles.kycDocumentTitle}>{label}</Text>
                            <Text style={[styles.kycDocumentAvailability, !uploaded && styles.kycDocumentMissing]}>
                              {uploaded ? 'Document uploaded' : 'Document not uploaded'}
                            </Text>
                          </View>
                          <StatusBadge status={status} size="sm" />
                        </View>
                        {status === 'rejected' && document.rejectionReason ? (
                          <Text style={styles.kycRejectionReason}>
                            Rejection reason: {document.rejectionReason}
                          </Text>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={uploaded ? `View ${label}` : `${label} unavailable`}
                          accessibilityState={{ disabled: !uploaded }}
                          disabled={!uploaded}
                          onPress={() => openDriverDocument(selectedDriver, type, label)}
                          style={[styles.viewDocumentButton, !uploaded && styles.viewDocumentButtonDisabled]}
                        >
                          <Ionicons
                            name="eye-outline"
                            size={15}
                            color={uploaded ? theme.colors.primary : theme.colors.muted}
                          />
                          <Text style={[styles.viewDocumentButtonText, !uploaded && styles.viewDocumentButtonTextDisabled]}>
                            {uploaded ? 'View Document' : 'Document Unavailable'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Assigned Vehicle</Text>
                  {selectedDriver.assignedVehicle ? (
                    <Text style={styles.detailValue}>
                      {selectedDriver.assignedVehicle.vehicleNumber} ({selectedDriver.assignedVehicle.vehicleModel})
                    </Text>
                  ) : (
                    <Text style={[styles.detailValue, { color: theme.colors.muted }]}>
                      No fleet vehicle currently assigned to this driver.
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => setSelectedDriver(null)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(previewDocument)}
        transparent
        animationType="fade"
        onRequestClose={closeDocumentPreview}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeDocumentPreview} />
          <View style={styles.documentPreviewModal}>
            <View style={styles.modalHeader}>
              <View style={styles.previewHeaderText}>
                <Text style={styles.modalTitle}>{previewDocument?.label || 'Driver Document'}</Text>
                <Text style={styles.modalSubtitle}>{previewDocument?.driverName || 'Driver'}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close document preview"
                onPress={closeDocumentPreview}
                style={styles.previewCloseButton}
              >
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.previewStatusRow}>
              <Text style={styles.previewStatusLabel}>Verification status</Text>
              <StatusBadge status={previewDocument?.status} size="sm" />
            </View>

            {previewDocument?.status === 'rejected' && previewDocument?.rejectionReason ? (
              <Text style={styles.kycRejectionReason}>
                Rejection reason: {previewDocument.rejectionReason}
              </Text>
            ) : null}

            {previewLoading ? (
              <View style={styles.previewState}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.previewMessage}>Loading secure document...</Text>
              </View>
            ) : previewError ? (
              <View style={styles.previewState}>
                <Ionicons name="alert-circle-outline" size={30} color={theme.colors.danger} />
                <Text style={styles.previewMessage}>{previewError}</Text>
                <Pressable onPress={refreshDocumentPreview} style={styles.previewRetryButton}>
                  <Text style={styles.previewRetryText}>Retry secure preview</Text>
                </Pressable>
              </View>
            ) : previewDocument?.viewUrl && (['jpg', 'jpeg', 'png', 'webp'].includes(previewDocument.format) || (previewDocument.format !== 'pdf' && !previewDocument.viewUrl.includes('.pdf'))) ? (
              <>
                <View style={styles.imagePreviewFrame}>
                  <Image
                    source={{ uri: previewDocument.viewUrl }}
                    resizeMode="contain"
                    onError={handleImagePreviewError}
                    style={[
                      styles.documentImage,
                      previewZoomed && styles.documentImageZoomed
                    ]}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPreviewZoomed((zoomed) => !zoomed)}
                  style={styles.previewSecondaryButton}
                >
                  <Ionicons name={previewZoomed ? 'contract-outline' : 'expand-outline'} size={15} color={theme.colors.primary} />
                  <Text style={styles.previewSecondaryText}>{previewZoomed ? 'Fit to screen' : 'Zoom image'}</Text>
                </Pressable>
              </>
            ) : previewDocument?.viewUrl && previewDocument.format === 'pdf' ? (
              <View style={styles.pdfPreviewState}>
                <Ionicons name="document-text-outline" size={42} color={theme.colors.primary} />
                <Text style={styles.previewMessage}>Open this PDF using a secure, short-lived preview link.</Text>
                <Pressable onPress={openPdfPreview} style={styles.previewRetryButton}>
                  <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.previewRetryText}>Open PDF securely</Text>
                </Pressable>
                <Pressable onPress={refreshDocumentPreview} style={styles.previewSecondaryButton}>
                  <Ionicons name="refresh-outline" size={15} color={theme.colors.primary} />
                  <Text style={styles.previewSecondaryText}>Refresh secure link</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.previewState}>
                <Ionicons name="alert-circle-outline" size={30} color={theme.colors.danger} />
                <Text style={styles.previewMessage}>This document format cannot be previewed.</Text>
                <Pressable onPress={refreshDocumentPreview} style={styles.previewRetryButton}>
                  <Text style={styles.previewRetryText}>Retry secure preview</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: 14
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
    gap: 6
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    gap: 6,
    position: 'relative'
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.primary
  },
  segmentText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  tabBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    marginLeft: 2
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  rosterHeader: {
    gap: 12
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    padding: 0
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10
  },
  filterChip: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary
  },
  filterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800'
  },
  addDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.teal,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
    gap: 4
  },
  addDriverText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  driverCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 10
  },
  driverCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  driverAvatarText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '800'
  },
  driverName: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800'
  },
  driverPhone: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  docSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    gap: 8
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  docItemLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '600'
  },
  driverCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4
  },
  vehicleNote: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  detailsBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  requestsContainer: {
    gap: 12
  },
  requestCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 10
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  requestName: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '800'
  },
  requestContact: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  requestKycGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    gap: 6
  },
  requestKycCell: {
    flex: 1,
    gap: 4
  },
  kycCellTitle: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.dangerGlow,
    padding: 8,
    borderRadius: theme.borderRadius.md
  },
  rejectionNoticeText: {
    color: theme.colors.danger,
    fontSize: 11,
    flex: 1
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  reqActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    gap: 6,
    borderWidth: 1
  },
  rejectBtn: {
    backgroundColor: theme.colors.dangerGlow,
    borderColor: theme.colors.danger
  },
  rejectBtnText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '800'
  },
  acceptBtn: {
    backgroundColor: theme.colors.green,
    borderColor: theme.colors.green
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 20,
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    gap: 14
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800'
  },
  modalSubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  regErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dangerGlow,
    padding: 10,
    borderRadius: theme.borderRadius.md
  },
  regErrorText: {
    color: theme.colors.danger,
    fontSize: 12,
    flex: 1
  },
  inputGroup: {
    gap: 5
  },
  inputLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  modalInput: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13
  },
  superAdminNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.md
  },
  superAdminNoticeText: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    flex: 1
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  detailCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 6
  },
  detailName: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800'
  },
  detailContact: {
    color: theme.colors.muted,
    fontSize: 12
  },
  detailSectionTitle: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  detailLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  detailValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700'
  },
  kycDocumentRow: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: 10,
    gap: 8
  },
  kycDocumentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8
  },
  kycDocumentTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  kycDocumentTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1
  },
  kycDocumentAvailability: {
    color: theme.colors.green,
    fontSize: 10,
    fontWeight: '600'
  },
  kycDocumentMissing: {
    color: theme.colors.muted
  },
  kycRejectionReason: {
    color: theme.colors.warning,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: theme.colors.warningGlow,
    padding: 8,
    borderRadius: theme.borderRadius.sm
  },
  viewDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryGlow
  },
  viewDocumentButtonDisabled: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  viewDocumentButtonText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800'
  },
  viewDocumentButtonTextDisabled: {
    color: theme.colors.muted
  },
  documentPreviewModal: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    gap: 12
  },
  previewHeaderText: {
    flex: 1,
    minWidth: 0
  },
  previewCloseButton: {
    padding: 6
  },
  previewStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  previewStatusLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  previewState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18
  },
  previewMessage: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  previewRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary
  },
  previewRetryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  imagePreviewFrame: {
    width: '100%',
    height: 420,
    maxHeight: '60%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md
  },
  documentImage: {
    width: '100%',
    height: '100%'
  },
  documentImageZoomed: {
    transform: [{ scale: 1.65 }]
  },
  previewSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center'
  },
  previewSecondaryText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  pdfPreviewState: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md
  }
});
