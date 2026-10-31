import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ConfirmationModal from '../components/ConfirmationModal';

const getVehiclePhotos = (vehicle) => {
  const photos = Array.isArray(vehicle?.vehicleImages)
    ? vehicle.vehicleImages.filter((photo) => typeof photo === 'string' && photo)
    : [];
  if (photos.length) return photos.slice(0, 4);
  return vehicle?.vehicleImage ? [vehicle.vehicleImage] : [];
};

function VehiclePhotoGrid({ photos, onAdd, onRemove, onReplace, progress = 0, disabled = false }) {
  const [loadingPhotos, setLoadingPhotos] = useState({});
  const [failedPhotos, setFailedPhotos] = useState({});
  const photoSlots = Array.from({ length: 4 }, (_, index) => photos[index] || null);
  const progressValue = Math.max(0, Math.min(100, Math.round(progress)));

  const getPhotoUri = (photo) => {
    if (!photo) return null;
    if (typeof photo === 'string') return photo;
    if (photo.previewUri) return photo.previewUri;
    if (Platform.OS === 'web' && photo.file && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        return URL.createObjectURL(photo.file);
      } catch {}
    }
    return photo.uri || null;
  };

  return (
    <View style={styles.photoPickerSection}>
      <View style={styles.photoPickerHeading}>
        <Text style={styles.photoPickerTitle}>Vehicle Photos (Optional)</Text>
        <Text style={styles.photoPickerHint}>Upload up to 4 vehicle photos · JPG, JPEG, PNG, WEBP · 5 MB each</Text>
      </View>
      <View style={styles.photoGrid}>
        {photoSlots.map((photo, index) => {
          const uri = getPhotoUri(photo);
          return (
            <View key={`vehicle-photo-${index}`} style={styles.photoSlot}>
              {photo ? (
                <>
                  {uri && !failedPhotos[uri] ? (
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      onLoadStart={() => setLoadingPhotos((current) => ({ ...current, [uri]: true }))}
                      onLoadEnd={() => setLoadingPhotos((current) => ({ ...current, [uri]: false }))}
                      onError={() => {
                        setLoadingPhotos((current) => ({ ...current, [uri]: false }));
                        setFailedPhotos((current) => ({ ...current, [uri]: true }));
                      }}
                      style={styles.photoThumbnail}
                    />
                  ) : (
                    <View style={styles.photoThumbnailPlaceholder}>
                      <Ionicons name="image-outline" size={24} color={theme.colors.muted} />
                      <Text style={styles.photoErrorText}>Preview unavailable</Text>
                    </View>
                  )}
                  {loadingPhotos[uri] ? (
                    <View style={styles.photoLoadingOverlay}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  ) : null}
                  {onRemove ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove vehicle photo ${index + 1}`}
                      onPress={() => onRemove(index)}
                      disabled={disabled}
                      style={styles.photoRemoveButton}
                    >
                      <Ionicons name="close" size={15} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                  {onReplace ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onReplace(index)}
                      disabled={disabled}
                      style={styles.photoReplaceButton}
                    >
                      <Ionicons name="refresh-outline" size={13} color={theme.colors.primary} />
                      <Text style={styles.photoReplaceText}>Replace</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={onAdd}
                  disabled={disabled}
                  style={styles.photoAddButton}
                >
                  <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.photoAddText}>Add Photo</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.photoCountText}>{photos.length}/4 Photos Uploaded</Text>
      {photos.length && progressValue > 0 && progressValue < 100 ? (
        <View style={styles.photoProgressContainer}>
          <View style={styles.photoProgressTrack}>
            <View style={[styles.photoProgressBar, { width: `${progressValue}%` }]} />
          </View>
          <Text style={styles.photoProgressText}>Uploading photos... {progressValue}%</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function FleetTab({
  vehicles = [],
  drivers = [],
  saving,
  onAddVehicle,
  onUpdateVehicle,
  onAssignDriver,
  onUnassignDriver,
  onUploadVehicleDoc,
  isAddModalOpen = false,
  onCloseAddModal,
  onOpenAddModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'available' | 'assigned' | 'inactive'

  // Modals state
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [assignModalVehicle, setAssignModalVehicle] = useState(null);
  const [unassignModalVehicle, setUnassignModalVehicle] = useState(null);
  const [galleryVehicle, setGalleryVehicle] = useState(null);
  const [galleryPhotoIndex, setGalleryPhotoIndex] = useState(0);
  const [photoLoadErrors, setPhotoLoadErrors] = useState({});
  const [photoProgress, setPhotoProgress] = useState(0);

  // Add vehicle form state
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    vehicleModel: '',
    vehicleType: 'mini-truck',
    capacity: '',
    capacityUnit: 'kg',
    bodyType: 'open'
  });
  const [formError, setFormError] = useState('');
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isImageAsset = (asset) => {
    const extension = asset.name?.split('.').pop()?.toLowerCase();
    const mimeType = asset.mimeType?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) &&
      (!mimeType || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType));
  };

  const pickVehiclePhotos = async ({ multiple = true } = {}) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple
    });
    if (result.canceled) return [];
    return (result.assets || []).map((asset) => {
      let previewUri = asset.uri;
      if (Platform.OS === 'web' && asset.file && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
          previewUri = URL.createObjectURL(asset.file);
        } catch {}
      }
      return {
        uri: previewUri || asset.uri,
        previewUri: previewUri || asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        file: asset.file
      };
    });
  };

  const validatePhotoSelection = (photos, availableSlots) => {
    if (!photos.length) return 'Select at least one photo.';
    if (photos.length > availableSlots) return `You can add only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} (maximum 4).`;
    const invalidPhoto = photos.find((photo) => !isImageAsset(photo));
    if (invalidPhoto) return 'Invalid image format. Select JPG, JPEG, PNG, or WEBP photos.';
    const oversizedPhoto = photos.find((photo) => Number.isFinite(photo.size) && photo.size > 5 * 1024 * 1024);
    if (oversizedPhoto) return 'Each vehicle photo must be 5 MB or smaller.';
    return '';
  };

  const choosePhotosForAdd = async () => {
    try {
      const selected = await pickVehiclePhotos();
      if (!selected.length) return;
      const validationMessage = validatePhotoSelection(selected, 4 - vehiclePhotos.length);
      if (validationMessage) {
        setFormError(validationMessage);
        return;
      }
      setFormError('');
      setPhotoProgress(0);
      setVehiclePhotos((current) => [...current, ...selected]);
    } catch (error) {
      setFormError(error?.message || 'Vehicle photos could not be selected. Please retry.');
    }
  };

  const choosePhotosForEdit = async () => {
    if (!editingVehicle) return;
    try {
      const selected = await pickVehiclePhotos();
      if (!selected.length) return;
      const validationMessage = validatePhotoSelection(selected, 4 - editingVehicle.photos.length);
      if (validationMessage) {
        setFormError(validationMessage);
        return;
      }
      setFormError('');
      setEditingVehicle((current) => ({
        ...current,
        photos: [...current.photos, ...selected]
      }));
    } catch (error) {
      setFormError(error?.message || 'Vehicle photos could not be selected. Please retry.');
    }
  };

  const replacePhoto = async (index) => {
    try {
      const [replacement] = await pickVehiclePhotos({ multiple: false });
      if (!replacement) return;
      const validationMessage = validatePhotoSelection([replacement], 1);
      if (validationMessage) {
        setFormError(validationMessage);
        return;
      }
      setFormError('');
      setEditingVehicle((current) => ({
        ...current,
        photos: current.photos.map((photo, photoIndex) => photoIndex === index ? replacement : photo)
      }));
    } catch (error) {
      setFormError(error?.message || 'The vehicle photo could not be replaced. Please retry.');
    }
  };

  // Eligible drivers for assignment (Verified KYC & Approved Agency Association)
  const eligibleDrivers = useMemo(() => {
    return drivers.filter((driver) =>
      driver.isActive !== false &&
      driver.approvalStatus === 'approved' &&
      driver.agencyAssociation?.status === 'approved' &&
      driver.documents?.idProof?.status === 'approved' &&
      driver.documents?.drivingLicense?.status === 'approved'
    );
  }, [drivers]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const q = searchQuery.toLowerCase();
      const num = (v.vehicleNumber || '').toLowerCase();
      const model = (v.vehicleModel || '').toLowerCase();
      const driverName = (v.driver?.fullName || v.driver?.name || '').toLowerCase();
      const matchesSearch = num.includes(q) || model.includes(q) || driverName.includes(q);

      if (!matchesSearch) return false;
      if (statusFilter === 'available') return v.isAvailable && v.isActive !== false && !v.driver;
      if (statusFilter === 'assigned') return Boolean(v.driver);
      if (statusFilter === 'inactive') return v.isActive === false;
      return true;
    });
  }, [vehicles, searchQuery, statusFilter]);

  const activeCount = vehicles.filter((v) => v.isActive !== false).length;
  const availableCount = vehicles.filter((v) => v.isAvailable && v.isActive !== false).length;
  const assignedCount = vehicles.filter((v) => Boolean(v.driver)).length;
  const inactiveCount = vehicles.filter((v) => v.isActive === false).length;

  const handleSaveAddVehicle = async () => {
    if (isSubmitting || Boolean(saving)) return;
    const capacity = Number(vehicleForm.capacity);
    if (!vehicleForm.vehicleNumber.trim() || !vehicleForm.vehicleModel.trim() || !Number.isFinite(capacity) || capacity <= 0) {
      setFormError('Please enter a vehicle number, model, and valid positive load capacity.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      await onAddVehicle({
        vehicleNumber: vehicleForm.vehicleNumber.trim(),
        vehicleModel: vehicleForm.vehicleModel.trim(),
        vehicleType: vehicleForm.vehicleType,
        loadCapacity: { value: capacity, unit: vehicleForm.capacityUnit },
        bodyType: vehicleForm.bodyType
      }, vehiclePhotos, setPhotoProgress);
      setVehicleForm({
        vehicleNumber: '',
        vehicleModel: '',
        vehicleType: 'mini-truck',
        capacity: '',
        capacityUnit: 'kg',
        bodyType: 'open'
      });
      setVehiclePhotos([]);
      setPhotoProgress(0);
      if (onCloseAddModal) onCloseAddModal();
    } catch (err) {
      setFormError(err?.message || 'Failed to add vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditVehicle = async () => {
    if (!editingVehicle || isSubmitting || Boolean(saving)) return;
    const capacity = Number(editingVehicle.capacity);
    if (!editingVehicle.vehicleModel.trim() || !Number.isFinite(capacity) || capacity <= 0) {
      return;
    }
    setFormError('');
    setPhotoProgress(0);
    setIsSubmitting(true);
    const retainedPhotos = editingVehicle.photos.filter((photo) => typeof photo === 'string');
    const newPhotos = editingVehicle.photos.filter((photo) => typeof photo !== 'string');
    try {
      await onUpdateVehicle(editingVehicle.id, {
        vehicleModel: editingVehicle.vehicleModel.trim(),
        vehicleType: editingVehicle.vehicleType,
        loadCapacity: { value: capacity, unit: editingVehicle.capacityUnit },
        bodyType: editingVehicle.bodyType
      }, newPhotos, retainedPhotos, setPhotoProgress);
      setEditingVehicle(null);
      setPhotoProgress(0);
    } catch (error) {
      setFormError(error?.message || 'Failed to update vehicle. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddModal = () => {
    setFormError('');
    setVehiclePhotos([]);
    setPhotoProgress(0);
    onOpenAddModal?.();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. FLEET STATS BAR */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{vehicles.length}</Text>
          <Text style={styles.metricLabel}>Total Fleet</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.green }]}>{activeCount}</Text>
          <Text style={styles.metricLabel}>Active</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.primary }]}>{assignedCount}</Text>
          <Text style={styles.metricLabel}>Assigned</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: theme.colors.warning }]}>{availableCount}</Text>
          <Text style={styles.metricLabel}>Available</Text>
        </View>
      </View>

      {/* 2. SEARCH & FILTER HEADER */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by number, model, driver..."
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: 'all', label: `All (${vehicles.length})` },
            { id: 'available', label: `Available (${availableCount})` },
            { id: 'assigned', label: `Assigned (${assignedCount})` },
            { id: 'inactive', label: `Inactive (${inactiveCount})` }
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setStatusFilter(tab.id)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable onPress={handleOpenAddModal} style={styles.addVehicleBtn}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addVehicleText}>Add Vehicle</Text>
        </Pressable>
      </View>

      {/* 3. VEHICLE LIST */}
      {filteredVehicles.length === 0 ? (
        <EmptyState
          icon="bus-outline"
          title="No Vehicles Found"
          description={searchQuery ? 'No vehicle matches your search query.' : 'Add your first commercial transport vehicle to build your agency fleet.'}
          actionLabel={searchQuery ? 'Clear Filter' : 'Add Vehicle'}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenAddModal}
        />
      ) : (
        filteredVehicles.map((vehicle) => {
          const assignedDriver = vehicle.driver?.fullName || vehicle.driver?.name;
          const photos = getVehiclePhotos(vehicle);
          const primaryPhoto = photos[0];
          const rcStatus = vehicle.documents?.registration?.status || 'not_uploaded';
          const insStatus = vehicle.documents?.insurance?.status || 'not_uploaded';
          const isVerified = rcStatus === 'approved' && insStatus === 'approved';

          return (
            <View key={vehicle._id} style={styles.vehicleCard}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleNumber}>{vehicle.vehicleNumber}</Text>
                  <Text style={styles.vehicleModel}>{vehicle.vehicleModel}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusBadge
                    status={vehicle.isActive === false ? 'inactive' : 'active'}
                    label={vehicle.isActive === false ? 'Inactive' : 'Active'}
                    size="sm"
                  />
                  {vehicle.isAvailable && vehicle.isActive !== false ? (
                    <View style={styles.availableTag}>
                      <Text style={styles.availableTagText}>Available</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View photos for ${vehicle.vehicleNumber}`}
                onPress={() => {
                  setGalleryVehicle(vehicle);
                  setGalleryPhotoIndex(0);
                }}
                style={styles.vehiclePhotoPreview}
              >
                {primaryPhoto && !photoLoadErrors[vehicle._id] ? (
                  <Image
                    source={{ uri: primaryPhoto }}
                    resizeMode="cover"
                    onLoadStart={() => setPhotoLoadErrors((current) => ({ ...current, [vehicle._id]: false }))}
                    onError={() => setPhotoLoadErrors((current) => ({ ...current, [vehicle._id]: true }))}
                    style={styles.vehiclePrimaryPhoto}
                  />
                ) : (
                  <View style={styles.vehiclePhotoPlaceholder}>
                    <Ionicons name="bus-outline" size={30} color={theme.colors.muted} />
                    <Text style={styles.vehiclePhotoPlaceholderText}>Vehicle photos unavailable</Text>
                  </View>
                )}
                <View style={styles.photoGalleryAction}>
                  <Ionicons name="images-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.photoGalleryActionText}>
                    {photos.length ? `View Photos (${photos.length})` : 'Vehicle Details'}
                  </Text>
                </View>
              </Pressable>

              {/* Specs & Type Chips */}
              <View style={styles.specsRow}>
                <View style={styles.specChip}>
                  <Ionicons name="car-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.specText}>{vehicle.vehicleType || 'Truck'}</Text>
                </View>
                <View style={styles.specChip}>
                  <Ionicons name="cube-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.specText}>
                    {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit || 'kg'}
                  </Text>
                </View>
                <View style={styles.specChip}>
                  <Ionicons name="layers-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.specText}>{vehicle.bodyType || 'Open'}</Text>
                </View>
              </View>

              {/* Assigned Driver Box */}
              <View style={styles.driverBox}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.driverDot, { backgroundColor: assignedDriver ? theme.colors.green : theme.colors.muted }]} />
                  <View>
                    <Text style={styles.driverBoxTitle}>Assigned Driver</Text>
                    <Text style={[styles.driverBoxValue, !assignedDriver && { color: theme.colors.muted }]}>
                      {assignedDriver || 'No driver assigned'}
                    </Text>
                  </View>
                </View>

                {assignedDriver ? (
                  <Pressable
                    onPress={() => setUnassignModalVehicle(vehicle)}
                    style={styles.unassignBtn}
                  >
                    <Text style={styles.unassignBtnText}>Unassign</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setAssignModalVehicle(vehicle)}
                    style={styles.assignDriverBtn}
                  >
                    <Text style={styles.assignDriverBtnText}>Assign Driver</Text>
                  </Pressable>
                )}
              </View>

              {/* Document verification status (RC & Insurance) */}
              <View style={styles.documentsContainer}>
                <View style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>Registration Certificate (RC)</Text>
                    {vehicle.documents?.registration?.rejectionReason ? (
                      <Text style={styles.docReason}>Reason: {vehicle.documents.registration.rejectionReason}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={rcStatus} size="sm" />
                  {['not_uploaded', 'rejected', 'missing'].includes(rcStatus) ? (
                    <Pressable
                      onPress={() => onUploadVehicleDoc(vehicle._id, 'registration')}
                      disabled={Boolean(saving)}
                      style={styles.uploadDocBtn}
                    >
                      <Ionicons name="cloud-upload" size={12} color={theme.colors.primary} />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>Vehicle Insurance</Text>
                    {vehicle.documents?.insurance?.rejectionReason ? (
                      <Text style={styles.docReason}>Reason: {vehicle.documents.insurance.rejectionReason}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={insStatus} size="sm" />
                  {['not_uploaded', 'rejected', 'missing'].includes(insStatus) ? (
                    <Pressable
                      onPress={() => onUploadVehicleDoc(vehicle._id, 'insurance')}
                      disabled={Boolean(saving)}
                      style={styles.uploadDocBtn}
                    >
                      <Ionicons name="cloud-upload" size={12} color={theme.colors.primary} />
                      <Text style={styles.uploadDocText}>Upload</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.actionsFooter}>
                <Pressable
                  onPress={() => setEditingVehicle({
                    id: vehicle._id,
                    vehicleModel: vehicle.vehicleModel || '',
                    vehicleType: vehicle.vehicleType || 'mini-truck',
                    capacity: String(vehicle.loadCapacity?.value || ''),
                    capacityUnit: vehicle.loadCapacity?.unit || 'kg',
                    bodyType: vehicle.bodyType || 'open',
                    photos: getVehiclePhotos(vehicle)
                  })}
                  style={styles.actionBtnOutline}
                >
                  <Ionicons name="create-outline" size={15} color={theme.colors.primary} />
                  <Text style={styles.actionBtnOutlineText}>Edit Vehicle</Text>
                </Pressable>

                <Pressable
                  onPress={() => onUpdateVehicle(vehicle._id, { isActive: vehicle.isActive === false })}
                  disabled={Boolean(saving)}
                  style={[styles.actionBtnOutline, vehicle.isActive === false ? styles.activateBtn : styles.deactivateBtn]}
                >
                  <Ionicons
                    name={vehicle.isActive === false ? 'play-outline' : 'pause-outline'}
                    size={15}
                    color={vehicle.isActive === false ? theme.colors.green : theme.colors.danger}
                  />
                  <Text
                    style={[
                      styles.actionBtnOutlineText,
                      { color: vehicle.isActive === false ? theme.colors.green : theme.colors.danger }
                    ]}
                  >
                    {vehicle.isActive === false ? 'Activate' : 'Deactivate'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {/* 4. ADD VEHICLE MODAL */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="slide"
        onRequestClose={onCloseAddModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onCloseAddModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Fleet Vehicle</Text>
                <Text style={styles.modalSubtitle}>Register a transport vehicle to your agency</Text>
              </View>
              <Pressable onPress={onCloseAddModal} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {formError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Registration Number *</Text>
                <TextInput
                  value={vehicleForm.vehicleNumber}
                  onChangeText={(val) => setVehicleForm((p) => ({ ...p, vehicleNumber: val.toUpperCase() }))}
                  placeholder="e.g. MH 12 AB 1234"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="characters"
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Model *</Text>
                <TextInput
                  value={vehicleForm.vehicleModel}
                  onChangeText={(val) => setVehicleForm((p) => ({ ...p, vehicleModel: val }))}
                  placeholder="e.g. Tata Ace Gold"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Category *</Text>
                <View style={styles.chipGrid}>
                  {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => {
                    const isSelected = vehicleForm.vehicleType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setVehicleForm((p) => ({ ...p, vehicleType: type }))}
                        style={[styles.typeChip, isSelected && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                          {type.replace('-', ' ')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <VehiclePhotoGrid
                photos={vehiclePhotos}
                onAdd={choosePhotosForAdd}
                onRemove={(index) => setVehiclePhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
                progress={photoProgress}
                disabled={Boolean(saving)}
              />

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Load Capacity *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={vehicleForm.capacity}
                    onChangeText={(val) => setVehicleForm((p) => ({ ...p, capacity: val }))}
                    placeholder="e.g. 1000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="decimal-pad"
                    style={[styles.modalInput, { flex: 2 }]}
                  />
                  <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                    {['kg', 'ton'].map((unit) => {
                      const isSelected = vehicleForm.capacityUnit === unit;
                      return (
                        <Pressable
                          key={unit}
                          onPress={() => setVehicleForm((p) => ({ ...p, capacityUnit: unit }))}
                          style={[styles.unitBtn, isSelected && styles.unitBtnActive]}
                        >
                          <Text style={[styles.unitBtnText, isSelected && styles.unitBtnTextActive]}>
                            {unit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Body Type</Text>
                <View style={styles.chipGrid}>
                  {['open', 'closed', 'container', 'flatbed'].map((type) => {
                    const isSelected = vehicleForm.bodyType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setVehicleForm((p) => ({ ...p, bodyType: type }))}
                        style={[styles.typeChip, isSelected && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable onPress={onCloseAddModal} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSaveAddVehicle}
                  disabled={Boolean(saving || isSubmitting)}
                  style={[styles.modalSubmitBtn, Boolean(saving || isSubmitting) && styles.modalSubmitBtnDisabled]}
                >
                  {saving === 'create-vehicle' || isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Add Vehicle</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. EDIT VEHICLE MODAL */}
      <Modal
        visible={Boolean(editingVehicle)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingVehicle(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditingVehicle(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Vehicle</Text>
              <Pressable onPress={() => setEditingVehicle(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {editingVehicle ? (
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
                {formError ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                    <Text style={styles.errorText}>{formError}</Text>
                  </View>
                ) : null}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Model</Text>
                  <TextInput
                    value={editingVehicle.vehicleModel}
                    onChangeText={(val) => setEditingVehicle((p) => ({ ...p, vehicleModel: val }))}
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Category</Text>
                  <View style={styles.chipGrid}>
                    {['mini-truck', 'pickup', 'small-truck', 'medium-truck', 'large-truck'].map((type) => {
                      const isSelected = editingVehicle.vehicleType === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => setEditingVehicle((p) => ({ ...p, vehicleType: type }))}
                          style={[styles.typeChip, isSelected && styles.typeChipActive]}
                        >
                          <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                            {type.replace('-', ' ')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Load Capacity</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={editingVehicle.capacity}
                      onChangeText={(val) => setEditingVehicle((p) => ({ ...p, capacity: val }))}
                      keyboardType="decimal-pad"
                      style={[styles.modalInput, { flex: 2 }]}
                    />
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                      {['kg', 'ton'].map((unit) => {
                        const isSelected = editingVehicle.capacityUnit === unit;
                        return (
                          <Pressable
                            key={unit}
                            onPress={() => setEditingVehicle((p) => ({ ...p, capacityUnit: unit }))}
                            style={[styles.unitBtn, isSelected && styles.unitBtnActive]}
                          >
                            <Text style={[styles.unitBtnText, isSelected && styles.unitBtnTextActive]}>
                              {unit}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Body Type</Text>
                  <View style={styles.chipGrid}>
                    {['open', 'closed', 'container', 'flatbed'].map((type) => {
                      const isSelected = editingVehicle.bodyType === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => setEditingVehicle((p) => ({ ...p, bodyType: type }))}
                          style={[styles.typeChip, isSelected && styles.typeChipActive]}
                        >
                          <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                            {type}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <VehiclePhotoGrid
                  photos={editingVehicle.photos}
                  onAdd={choosePhotosForEdit}
                  onRemove={(index) => setEditingVehicle((current) => ({
                    ...current,
                    photos: current.photos.filter((_, photoIndex) => photoIndex !== index)
                  }))}
                  onReplace={replacePhoto}
                  progress={photoProgress}
                  disabled={Boolean(saving)}
                />

                <View style={styles.modalActions}>
                  <Pressable onPress={() => setEditingVehicle(null)} style={styles.modalCancelBtn}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSaveEditVehicle}
                    disabled={Boolean(saving || isSubmitting)}
                    style={[styles.modalSubmitBtn, Boolean(saving || isSubmitting) && styles.modalSubmitBtnDisabled]}
                  >
                    {saving === 'update-vehicle' || isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalSubmitText}>Save Changes</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(galleryVehicle)}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryVehicle(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setGalleryVehicle(null)} />
          <View style={styles.galleryModal}>
            <View style={styles.modalHeader}>
              <View style={styles.galleryHeaderText}>
                <Text style={styles.modalTitle}>Vehicle Details</Text>
                <Text style={styles.modalSubtitle}>
                  {galleryVehicle?.vehicleNumber} · {galleryVehicle?.vehicleModel}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setGalleryVehicle(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {galleryVehicle && getVehiclePhotos(galleryVehicle).length ? (
              <>
                <View style={styles.galleryMainFrame}>
                  <Image
                    source={{ uri: getVehiclePhotos(galleryVehicle)[galleryPhotoIndex] }}
                    resizeMode="contain"
                    style={styles.galleryMainImage}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryThumbnails}>
                  {getVehiclePhotos(galleryVehicle).map((photo, index) => (
                    <Pressable
                      key={`${photo}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Show vehicle photo ${index + 1}`}
                      onPress={() => setGalleryPhotoIndex(index)}
                      style={[styles.galleryThumbnailButton, galleryPhotoIndex === index && styles.galleryThumbnailButtonSelected]}
                    >
                      <Image source={{ uri: photo }} resizeMode="cover" style={styles.galleryThumbnailImage} />
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.galleryPhotoCount}>{galleryPhotoIndex + 1} of {getVehiclePhotos(galleryVehicle).length} photos</Text>
              </>
            ) : (
              <View style={styles.galleryEmptyState}>
                <Ionicons name="bus-outline" size={44} color={theme.colors.muted} />
                <Text style={styles.vehiclePhotoPlaceholderText}>No vehicle photos uploaded</Text>
              </View>
            )}
            <Text style={styles.galleryVehicleSpecs}>
              {galleryVehicle?.vehicleType || 'Truck'} · {galleryVehicle?.loadCapacity?.value} {galleryVehicle?.loadCapacity?.unit || 'kg'} · {galleryVehicle?.bodyType || 'open'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* 7. ASSIGN DRIVER MODAL */}
      <Modal
        visible={Boolean(assignModalVehicle)}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVehicle(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAssignModalVehicle(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Driver</Text>
                <Text style={styles.modalSubtitle}>Vehicle: {assignModalVehicle?.vehicleNumber}</Text>
              </View>
              <Pressable onPress={() => setAssignModalVehicle(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              {eligibleDrivers.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No Eligible Drivers"
                  description="Only drivers with approved KYC documents (Aadhaar & DL) and approved agency association can be assigned to fleet vehicles."
                />
              ) : (
                eligibleDrivers.map((driver) => {
                  const driverName = driver.fullName || driver.user?.name || 'Driver';
                  return (
                    <Pressable
                      key={driver._id}
                      onPress={async () => {
                        await onAssignDriver(assignModalVehicle._id, driver._id);
                        setAssignModalVehicle(null);
                      }}
                      style={styles.driverSelectItem}
                    >
                      <View style={styles.driverSelectAvatar}>
                        <Text style={styles.driverSelectAvatarText}>{driverName.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.driverSelectName}>{driverName}</Text>
                        <Text style={styles.driverSelectPhone}>{driver.phone || driver.user?.phone}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 7. UNASSIGN CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={Boolean(unassignModalVehicle)}
        onClose={() => setUnassignModalVehicle(null)}
        onConfirm={async () => {
          if (unassignModalVehicle) {
            await onUnassignDriver(unassignModalVehicle._id);
            setUnassignModalVehicle(null);
          }
        }}
        title="Unassign Driver"
        message={`Are you sure you want to unassign driver from vehicle ${unassignModalVehicle?.vehicleNumber}?`}
        confirmLabel="Unassign"
        danger
        loading={Boolean(saving)}
      />
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
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center'
  },
  metricItem: {
    flex: 1,
    alignItems: 'center'
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border
  },
  metricValue: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: '800'
  },
  metricLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2
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
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
    gap: 4
  },
  addVehicleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  vehicleCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    gap: 12
  },
  vehiclePhotoPreview: {
    height: 150,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  vehiclePrimaryPhoto: {
    width: '100%',
    height: '100%'
  },
  vehiclePhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  vehiclePhotoPlaceholderText: {
    color: theme.colors.muted,
    fontSize: 11,
    textAlign: 'center'
  },
  photoGalleryAction: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(8, 17, 31, 0.88)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  photoGalleryActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  vehicleNumber: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  vehicleModel: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  availableTag: {
    backgroundColor: theme.colors.greenGlow,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  availableTagText: {
    color: theme.colors.green,
    fontSize: 10,
    fontWeight: '800'
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 4
  },
  specText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  driverBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 10,
    gap: 8
  },
  driverDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  driverBoxTitle: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  driverBoxValue: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '800'
  },
  assignDriverBtn: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md
  },
  assignDriverBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800'
  },
  unassignBtn: {
    backgroundColor: theme.colors.dangerGlow,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md
  },
  unassignBtnText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: '800'
  },
  documentsContainer: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: 10,
    gap: 8
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  docName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  docReason: {
    color: theme.colors.danger,
    fontSize: 11,
    marginTop: 2
  },
  uploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm
  },
  uploadDocText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  actionsFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 6
  },
  activateBtn: {
    borderColor: theme.colors.green
  },
  deactivateBtn: {
    borderColor: theme.colors.border
  },
  actionBtnOutlineText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
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
  galleryModal: {
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
  galleryHeaderText: {
    flex: 1,
    minWidth: 0
  },
  galleryMainFrame: {
    width: '100%',
    height: 340,
    maxHeight: '55%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface
  },
  galleryMainImage: {
    width: '100%',
    height: '100%'
  },
  galleryThumbnails: {
    alignItems: 'center',
    gap: 8
  },
  galleryThumbnailButton: {
    width: 68,
    height: 58,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  galleryThumbnailButtonSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2
  },
  galleryThumbnailImage: {
    width: '100%',
    height: '100%'
  },
  galleryPhotoCount: {
    color: theme.colors.muted,
    fontSize: 11,
    textAlign: 'center'
  },
  galleryVehicleSpecs: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'capitalize'
  },
  galleryEmptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dangerGlow,
    padding: 10,
    borderRadius: theme.borderRadius.md
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    flex: 1
  },
  photoPickerSection: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    gap: 10
  },
  photoPickerHeading: {
    gap: 3
  },
  photoPickerTitle: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  photoPickerHint: {
    color: theme.colors.muted,
    fontSize: 10,
    lineHeight: 15
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8
  },
  photoSlot: {
    width: '48%',
    height: 112,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card
  },
  photoThumbnail: {
    width: '100%',
    height: '100%'
  },
  photoThumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
    backgroundColor: theme.colors.surface
  },
  photoErrorText: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center'
  },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.45)'
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
    borderRadius: 13
  },
  photoReplaceButton: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(8, 17, 31, 0.9)'
  },
  photoReplaceText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800'
  },
  photoAddButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5
  },
  photoAddText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  photoCountText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right'
  },
  photoProgressContainer: {
    gap: 4
  },
  photoProgressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: theme.colors.border
  },
  photoProgressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary
  },
  photoProgressText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700'
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  typeChip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  typeChipActive: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary
  },
  typeChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  typeChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800'
  },
  unitBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  unitBtnActive: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary
  },
  unitBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  unitBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '900'
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
  modalSubmitBtnDisabled: {
    opacity: 0.65
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  driverSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    gap: 10
  },
  driverSelectAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center'
  },
  driverSelectAvatarText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '800'
  },
  driverSelectName: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '800'
  },
  driverSelectPhone: {
    color: theme.colors.muted,
    fontSize: 11
  }
});
