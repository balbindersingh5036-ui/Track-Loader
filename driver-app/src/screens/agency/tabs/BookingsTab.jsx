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
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import {
  bookingFilters,
  filterAgencyBookings,
  getBookingFilterCounts
} from '../../../utils/agencyBookings.mjs';

export default function BookingsTab({
  bookings = [],
  drivers = [],
  vehicles = [],
  saving,
  loading = false,
  error = '',
  onRetry,
  onAssignBooking
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState(null);

  // Assignment Modal
  const [selectedBookingForAssign, setSelectedBookingForAssign] = useState(null);
  const [chosenCandidate, setChosenCandidate] = useState(null); // { driverId, vehicleId }

  // Eligible & Verified Drivers
  const eligibleDrivers = useMemo(() => {
    return drivers.filter((driver) =>
      driver.isActive !== false &&
      driver.approvalStatus === 'approved' &&
      driver.agencyAssociation?.status === 'approved' &&
      driver.documents?.idProof?.status === 'approved' &&
      driver.documents?.drivingLicense?.status === 'approved'
    );
  }, [drivers]);

  // Eligible & Verified Vehicles
  const eligibleVehicles = useMemo(() => {
    return vehicles.filter((vehicle) =>
      vehicle.isActive !== false &&
      vehicle.documents?.registration?.status === 'approved' &&
      vehicle.documents?.insurance?.status === 'approved'
    );
  }, [vehicles]);

  const kgCapacity = (vehicle) => {
    const capacity = Number(vehicle.loadCapacity?.value || 0);
    return vehicle.loadCapacity?.unit === 'ton' ? capacity * 1000 : capacity;
  };

  const filterCounts = useMemo(() => getBookingFilterCounts(bookings), [bookings]);
  const filteredBookings = useMemo(() => {
    return filterAgencyBookings(bookings, searchQuery, statusFilter);
  }, [bookings, searchQuery, statusFilter]);

  // Compute Candidates for selected booking
  const candidatesForSelectedBooking = useMemo(() => {
    if (!selectedBookingForAssign) return [];
    const bookingWeightKg = selectedBookingForAssign.weight?.unit === 'ton'
      ? Number(selectedBookingForAssign.weight?.value || 0) * 1000
      : Number(selectedBookingForAssign.weight?.value || 0);

    return eligibleDrivers.flatMap((driver) =>
      eligibleVehicles
        .filter((vehicle) =>
          String(vehicle.driver?._id || vehicle.driver) === String(driver._id) &&
          vehicle.isAvailable &&
          vehicle.vehicleType === selectedBookingForAssign.vehicleType &&
          kgCapacity(vehicle) >= bookingWeightKg
        )
        .map((vehicle) => ({ driver, vehicle }))
    );
  }, [selectedBookingForAssign, eligibleDrivers, eligibleVehicles]);

  const handleConfirmAssignment = async () => {
    if (!selectedBookingForAssign || !chosenCandidate) return;
    await onAssignBooking(selectedBookingForAssign._id, chosenCandidate.driverId, chosenCandidate.vehicleId);
    setSelectedBookingForAssign(null);
    setChosenCandidate(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsContainer}>
      {/* 1. SEARCH INPUT */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by ID, customer, location..."
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* 2. FILTER CHIPS */}
      <ScrollView
        horizontal
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {bookingFilters.map((chip) => {
          const isSelected = statusFilter === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setStatusFilter(chip.id)}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
            >
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {chip.label} ({filterCounts[chip.id] ?? 0})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>

      {/* 3. BOOKINGS LIST */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.stateText}>Loading agency bookings...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={30} color={theme.colors.danger} />
          <Text style={styles.stateTitle}>Bookings could not be loaded</Text>
          <Text style={styles.stateText}>{error}</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="No Bookings Yet"
          description="No agency bookings were returned for your account."
          actionLabel="Refresh"
          onAction={onRetry}
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No Bookings Found"
          description={searchQuery ? 'No booking matches this search and status filter.' : 'No bookings match this status filter.'}
          actionLabel={searchQuery ? 'Clear Search' : 'Show All'}
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      ) : (
        filteredBookings.map((booking) => {
          const bookingId = booking._id;
          const displayId = booking.bookingId || bookingId.slice(-6).toUpperCase();
          const fare = booking.finalFare || booking.estimatedFare || 0;
          const isUnassigned = !booking.driver && ['unassigned', 'rejected', undefined].includes(booking.assignmentStatus);
          const isScheduled = booking.bookingMode === 'scheduled';
          const pickupDate = booking.preferredPickupDate || booking.createdAt;
          const scheduledDate = pickupDate ? new Date(pickupDate).toLocaleDateString() : null;

          return (
            <View key={bookingId} style={styles.bookingCard}>
              {/* Top Row: ID, Fare, Status */}
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.bookingId}>#{displayId}</Text>
                  {isScheduled ? (
                    <View style={styles.scheduledPill}>
                      <Ionicons name="calendar-outline" size={11} color={theme.colors.warning} />
                      <Text style={styles.scheduledPillText}>SCHEDULED</Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.fareAmount}>₹{fare}</Text>
                  <StatusBadge
                    status={booking.assignmentStatus || booking.bookingStatus}
                    size="sm"
                  />
                </View>
              </View>

              {scheduledDate ? (
                <View style={styles.scheduledTimingBox}>
                  <Ionicons name="time-outline" size={13} color={theme.colors.warning} />
                  <Text style={styles.scheduledTimingText}>
                    {isScheduled ? 'Pickup: ' : 'Travel date: '}{scheduledDate}
                    {booking.preferredPickupTime ? ` at ${booking.preferredPickupTime}` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Route: Pickup & Drop */}
              <View style={styles.routeBox}>
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.green }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>PICKUP</Text>
                    <Text style={styles.routeAddress} numberOfLines={2}>
                      {booking.pickup?.address || 'Pickup location'}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusRows}>
                  <Text style={styles.statusText}>Booking status: <Text style={styles.statusValue}>{booking.bookingStatus || 'Unknown'}</Text></Text>
                  <Text style={styles.statusText}>Assignment status: <Text style={styles.statusValue}>{booking.assignmentStatus || 'unassigned'}</Text></Text>
                </View>

                <View style={styles.routeLine} />

                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>DROP</Text>
                    <Text style={styles.routeAddress} numberOfLines={2}>
                      {booking.drop?.address || 'Drop location'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cargo & Specs */}
              <View style={styles.specsRow}>
                <View style={styles.specItem}>
                  <Ionicons name="cube-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.specText}>
                    {booking.goods || 'General'} ({booking.weight?.value || 0} {booking.weight?.unit || 'kg'})
                  </Text>
                </View>
                <View style={styles.specItem}>
                  <Ionicons name="car-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.specText}>{booking.vehicleType || 'Truck'}</Text>
                </View>
                {booking.distanceKm ? (
                  <View style={styles.specItem}>
                    <Ionicons name="navigate-outline" size={13} color={theme.colors.muted} />
                    <Text style={styles.specText}>{booking.distanceKm} km</Text>
                  </View>
                ) : null}
              </View>

              {/* Customer Contact */}
              {booking.customer ? (
                <View style={styles.customerRow}>
                  <Ionicons name="person-circle-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.customerName}>
                    {booking.customer.name || 'Customer'}
                  </Text>
                  {booking.customer.phone ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${booking.customer.phone}`)}
                      style={styles.callCustBtn}
                    >
                      <Ionicons name="call" size={12} color={theme.colors.primary} />
                      <Text style={styles.callCustText}>{booking.customer.phone}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Assigned Driver / Vehicle Note */}
              {booking.driver ? (
                <View style={styles.assignmentInfoBox}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignmentInfoTitle}>Assigned Driver & Truck</Text>
                    <Text style={styles.assignmentInfoText}>
                      {booking.driver.fullName || booking.driver.name} · {booking.vehicle?.vehicleNumber || 'Assigned Vehicle'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Driver Previous Rejection Note */}
              {booking.rejectedReason ? (
                <View style={styles.rejectionNotice}>
                  <Ionicons name="alert-circle" size={14} color={theme.colors.warning} />
                  <Text style={styles.rejectionNoticeText}>
                    Previous driver response: {booking.rejectedReason}
                  </Text>
                </View>
              ) : null}

              {/* Action Button: Assign Driver */}
              {isUnassigned && booking.bookingStatus === 'pending' ? (
                <Pressable
                  onPress={() => {
                    setSelectedBookingForAssign(booking);
                    setChosenCandidate(null);
                  }}
                  style={styles.assignActionBtn}
                >
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  <Text style={styles.assignActionBtnText}>Assign Driver & Fleet Vehicle</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedBookingForDetails(booking)}
                style={styles.detailsActionBtn}
              >
                <Ionicons name="open-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.detailsActionText}>View Details</Text>
              </Pressable>
            </View>
          );
        })
      )}
      </ScrollView>

      {/* 4. ASSIGN DRIVER & VEHICLE MODAL */}
      <Modal
        visible={Boolean(selectedBookingForAssign)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBookingForAssign(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectedBookingForAssign(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Booking</Text>
                <Text style={styles.modalSubtitle}>
                  Order #{selectedBookingForAssign?.bookingId || selectedBookingForAssign?._id?.slice(-6).toUpperCase()} · {selectedBookingForAssign?.vehicleType}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedBookingForAssign(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.reqBadgeRow}>
              <Text style={styles.reqBadgeText}>
                Requires: {selectedBookingForAssign?.vehicleType} · {selectedBookingForAssign?.weight?.value} {selectedBookingForAssign?.weight?.unit || 'kg'}
              </Text>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              {candidatesForSelectedBooking.length === 0 ? (
                <EmptyState
                  icon="alert-circle-outline"
                  title="No Matching Drivers & Trucks"
                  description="No approved agency driver is currently assigned to an available vehicle matching this booking category and capacity requirement."
                />
              ) : (
                candidatesForSelectedBooking.map(({ driver, vehicle }) => {
                  const isSelected = chosenCandidate?.driverId === driver._id && chosenCandidate?.vehicleId === vehicle._id;

                  return (
                    <Pressable
                      key={`${driver._id}-${vehicle._id}`}
                      onPress={() => setChosenCandidate({ driverId: driver._id, vehicleId: vehicle._id })}
                      style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
                    >
                      <View style={styles.candidateRadio}>
                        {isSelected ? <View style={styles.candidateRadioDot} /> : null}
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.candidateDriverName}>
                          {driver.fullName || driver.user?.name}
                        </Text>
                        <Text style={styles.candidateVehicleDetails}>
                          {vehicle.vehicleNumber} ({vehicle.vehicleModel}) · {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}
                        </Text>
                      </View>

                      <StatusBadge status="verified" label="Eligible" size="sm" />
                    </Pressable>
                  );
                })
              )}

              {candidatesForSelectedBooking.length > 0 ? (
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setSelectedBookingForAssign(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirmAssignment}
                    disabled={Boolean(saving) || !chosenCandidate}
                    style={[
                      styles.modalSubmitBtn,
                      (!chosenCandidate || Boolean(saving)) && { opacity: 0.5 }
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Confirm Assignment</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedBookingForDetails)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBookingForDetails(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectedBookingForDetails(null)} />
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Booking Details</Text>
                <Text style={styles.modalSubtitle}>
                  #{selectedBookingForDetails?.bookingId || selectedBookingForDetails?._id}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setSelectedBookingForDetails(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={theme.colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              <Text style={styles.detailsText}>Customer: {selectedBookingForDetails?.customer?.name || 'Not available'}</Text>
              {selectedBookingForDetails?.customer?.phone ? <Text style={styles.detailsText}>Contact: {selectedBookingForDetails.customer.phone}</Text> : null}
              <Text style={styles.detailsText}>Pickup: {selectedBookingForDetails?.pickup?.address || 'Not available'}</Text>
              <Text style={styles.detailsText}>Drop: {selectedBookingForDetails?.drop?.address || 'Not available'}</Text>
              <Text style={styles.detailsText}>Travel: {selectedBookingForDetails?.preferredPickupDate ? new Date(selectedBookingForDetails.preferredPickupDate).toLocaleString() : 'Not specified'} {selectedBookingForDetails?.preferredPickupTime || ''}</Text>
              <Text style={styles.detailsText}>Vehicle category: {selectedBookingForDetails?.vehicleType || 'Not specified'}</Text>
              <Text style={styles.detailsText}>Fare: ₹{selectedBookingForDetails?.finalFare || selectedBookingForDetails?.estimatedFare || 0}</Text>
              <Text style={styles.detailsText}>Booking status: {selectedBookingForDetails?.bookingStatus || 'Unknown'}</Text>
              <Text style={styles.detailsText}>Assignment status: {selectedBookingForDetails?.assignmentStatus || 'unassigned'}</Text>
              <Text style={styles.detailsText}>Driver: {selectedBookingForDetails?.driver?.fullName || selectedBookingForDetails?.driver?.name || 'Unassigned'}</Text>
              <Text style={styles.detailsText}>Vehicle: {selectedBookingForDetails?.vehicle?.vehicleNumber || 'Unassigned'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0
  },
  controlsContainer: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    gap: 12
  },
  listScroll: {
    flex: 1,
    minHeight: 0
  },
  listContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 14
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
  filterScroll: {
    height: 42,
    maxHeight: 42,
    minHeight: 42,
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch'
  },
  filterContent: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 2
  },
  filterChip: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    height: 38,
    minHeight: 38,
    maxHeight: 38,
    maxWidth: 170,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: theme.colors.primary
  },
  filterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
    includeFontPadding: false
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800'
  },
  bookingCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    gap: 12
  },
  stateContainer: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  stateTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center'
  },
  stateText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 4
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  statusRows: {
    gap: 4,
    backgroundColor: theme.colors.surface,
    padding: 9,
    borderRadius: theme.borderRadius.md
  },
  statusText: {
    color: theme.colors.muted,
    fontSize: 11,
    textTransform: 'capitalize'
  },
  statusValue: {
    color: theme.colors.ink,
    fontWeight: '800'
  },
  detailsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md
  },
  detailsActionText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  detailsModal: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 18,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    gap: 12
  },
  detailsText: {
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    fontSize: 12,
    lineHeight: 18
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  bookingId: {
    color: theme.colors.teal,
    fontSize: 15,
    fontWeight: '800'
  },
  scheduledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.warningGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  scheduledPillText: {
    color: theme.colors.warning,
    fontSize: 9,
    fontWeight: '800'
  },
  fareAmount: {
    color: theme.colors.accent,
    fontSize: 17,
    fontWeight: '900'
  },
  scheduledTimingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.borderRadius.md
  },
  scheduledTimingText: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: '700'
  },
  routeBox: {
    gap: 2,
    paddingVertical: 2
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: theme.colors.border,
    marginLeft: 3.5,
    marginVertical: 1
  },
  routeLabel: {
    color: theme.colors.muted,
    fontSize: 9,
    fontWeight: '700'
  },
  routeAddress: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingTop: 8
  },
  specItem: {
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
    fontWeight: '600'
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.borderRadius.md
  },
  customerName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  callCustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm
  },
  callCustText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  assignmentInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.greenGlow,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 1,
    padding: 10,
    borderRadius: theme.borderRadius.md
  },
  assignmentInfoTitle: {
    color: theme.colors.green,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  assignmentInfoText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '800'
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningGlow,
    padding: 8,
    borderRadius: theme.borderRadius.md
  },
  rejectionNoticeText: {
    color: theme.colors.warning,
    fontSize: 11,
    flex: 1
  },
  assignActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 11,
    borderRadius: theme.borderRadius.md,
    gap: 6,
    marginTop: 4
  },
  assignActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    maxWidth: 480,
    maxHeight: '90%',
    gap: 12
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
  reqBadgeRow: {
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.borderRadius.sm
  },
  reqBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    gap: 12
  },
  candidateCardSelected: {
    backgroundColor: '#0E3B53',
    borderColor: theme.colors.primary
  },
  candidateRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  candidateRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary
  },
  candidateDriverName: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800'
  },
  candidateVehicleDetails: {
    color: theme.colors.muted,
    fontSize: 11
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
  }
});
