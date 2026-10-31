import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

export default function OverviewTab({
  agency,
  stats,
  drivers = [],
  requests = [],
  vehicles = [],
  bookings = [],
  onNavigateTab,
  onOpenRegisterDriver,
  onOpenAddVehicle,
  onOpenProfileKyc
}) {
  const pendingRequests = requests.filter(
    (item) => item.agencyAssociation?.status === 'pending'
  );
  const activeVehicles = vehicles.filter((v) => v.isActive !== false);
  const inactiveVehicles = vehicles.filter((v) => v.isActive === false);
  const availableVehicles = vehicles.filter((v) => v.isAvailable && v.isActive !== false);

  const pendingBookings = bookings.filter(
    (b) => (!b.driver && ['unassigned', 'rejected', undefined].includes(b.assignmentStatus)) ||
           (b.bookingStatus === 'pending' && !b.driver)
  );
  const awaitingDriverAcceptance = bookings.filter(
    (b) => b.assignmentStatus === 'pending_acceptance' || (b.bookingStatus === 'pending' && b.driver)
  );
  const acceptedBookings = bookings.filter(
    (b) => b.bookingStatus === 'accepted' || b.assignmentStatus === 'accepted'
  );
  const completedBookings = bookings.filter(
    (b) => b.bookingStatus === 'completed'
  );

  // Agency KYC Document progress (5 docs total)
  const docKeys = ['ownerAadhaar', 'businessRegistration', 'tradeLicense', 'gstCertificate', 'taxId'];
  const uploadedDocs = docKeys.filter((key) => agency?.documents?.[key]?.status && agency?.documents?.[key]?.status !== 'not_uploaded');
  const approvedDocs = docKeys.filter((key) => agency?.documents?.[key]?.status === 'approved');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. WELCOME & VERIFICATION STATUS BANNER */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeSubtitle}>Agency Portal</Text>
            <Text style={styles.welcomeTitle}>
              {agency?.agencyName || 'Welcome Partner'}
            </Text>
          </View>
          <StatusBadge
            status={agency?.approvalStatus}
            label={
              agency?.approvalStatus === 'approved'
                ? 'Super Admin Approved'
                : agency?.approvalStatus === 'rejected'
                ? 'Approval Rejected'
                : 'Pending Verification'
            }
          />
        </View>

        <Text style={styles.welcomeDescription}>
          {agency?.approvalStatus === 'approved'
            ? 'Manage your fleet vehicles, driver assignments, and customer transportation bookings.'
            : 'Your agency registration is pending final verification from the Super Admin. You can still set up your fleet and review drivers.'}
        </Text>

        {agency?.rejectionReason ? (
          <View style={styles.rejectionAlert}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
            <Text style={styles.rejectionText}>
              Reason: {agency.rejectionReason}
            </Text>
          </View>
        ) : null}

        {/* KYC Progress Widget */}
        <Pressable
          onPress={onOpenProfileKyc}
          style={styles.kycProgressRow}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.kycProgressLabel}>Agency KYC Documents</Text>
              <Text style={styles.kycProgressCount}>
                {approvedDocs.length} of 5 Verified
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(approvedDocs.length / 5) * 100}%` }
                ]}
              />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* 2. QUICK ACTIONS ROW */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={styles.quickActionsGrid}>
        <Pressable
          onPress={onOpenAddVehicle}
          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.actionPressed]}
        >
          <View style={[styles.actionIconBubble, { backgroundColor: theme.colors.primaryGlow }]}>
            <Ionicons name="bus" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.actionBtnText}>Add Vehicle</Text>
        </Pressable>

        <Pressable
          onPress={onOpenRegisterDriver}
          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.actionPressed]}
        >
          <View style={[styles.actionIconBubble, { backgroundColor: theme.colors.tealGlow }]}>
            <Ionicons name="person-add" size={20} color={theme.colors.teal} />
          </View>
          <Text style={styles.actionBtnText}>Register Driver</Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigateTab('Drivers')}
          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.actionPressed]}
        >
          <View style={[styles.actionIconBubble, { backgroundColor: theme.colors.accentGlow }]}>
            <Ionicons name="document-text" size={20} color={theme.colors.accent} />
          </View>
          <Text style={styles.actionBtnText}>Requests ({pendingRequests.length})</Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigateTab('Bookings')}
          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.actionPressed]}
        >
          <View style={[styles.actionIconBubble, { backgroundColor: theme.colors.greenGlow }]}>
            <Ionicons name="clipboard" size={20} color={theme.colors.green} />
          </View>
          <Text style={styles.actionBtnText}>Bookings</Text>
        </Pressable>
      </View>

      {/* 3. KEY PERFORMANCE INDICATORS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fleet & Driver Metrics</Text>
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          title="Total Drivers"
          value={stats?.total ?? drivers.length}
          subtitle={`${stats?.superAdminApprovedAndEligible ?? drivers.filter(d => d.approvalStatus === 'approved').length} verified`}
          icon="people"
          iconColor={theme.colors.primary}
          badgeText={pendingRequests.length > 0 ? `${pendingRequests.length} Req` : null}
          badgeColor={theme.colors.warning}
          onPress={() => onNavigateTab('Drivers')}
        />
        <StatCard
          title="Joining Requests"
          value={stats?.pendingAgency ?? pendingRequests.length}
          subtitle="Awaiting your approval"
          icon="git-pull-request"
          iconColor={theme.colors.warning}
          onPress={() => onNavigateTab('Drivers')}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title="Active Vehicles"
          value={activeVehicles.length}
          subtitle={`${availableVehicles.length} available now`}
          icon="car-sport"
          iconColor={theme.colors.teal}
          onPress={() => onNavigateTab('Fleet')}
        />
        <StatCard
          title="Inactive Vehicles"
          value={inactiveVehicles.length}
          subtitle="Maintenance or offline"
          icon="pause-circle"
          iconColor={theme.colors.muted}
          onPress={() => onNavigateTab('Fleet')}
        />
      </View>

      {/* 4. BOOKING ACTIVITY METRICS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Booking Pipeline</Text>
      </View>
      <View style={styles.statsGrid}>
        <StatCard
          title="Total Bookings"
          value={bookings.length}
          subtitle="All received orders"
          icon="cube"
          iconColor={theme.colors.primary}
          onPress={() => onNavigateTab('Bookings')}
        />
        <StatCard
          title="Needs Assignment"
          value={pendingBookings.length}
          subtitle="Assign driver & truck"
          icon="alert-circle"
          iconColor={theme.colors.accent}
          badgeText={pendingBookings.length > 0 ? 'Action Needed' : null}
          badgeColor={theme.colors.accent}
          onPress={() => onNavigateTab('Bookings')}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title="Awaiting Acceptance"
          value={awaitingDriverAcceptance.length}
          subtitle="Pending driver response"
          icon="time"
          iconColor={theme.colors.warning}
          onPress={() => onNavigateTab('Bookings')}
        />
        <StatCard
          title="Completed Trips"
          value={completedBookings.length}
          subtitle="Delivered successfully"
          icon="checkmark-done"
          iconColor={theme.colors.green}
          onPress={() => onNavigateTab('Bookings')}
        />
      </View>

      {/* 5. RECENT BOOKINGS PREVIEW */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Bookings</Text>
        {bookings.length > 0 ? (
          <Pressable onPress={() => onNavigateTab('Bookings')}>
            <Text style={styles.seeAllText}>View All ({bookings.length})</Text>
          </Pressable>
        ) : null}
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={32} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No Bookings Yet</Text>
          <Text style={styles.emptySubtitle}>Customer bookings assigned to your agency will show up here.</Text>
        </View>
      ) : (
        bookings.slice(0, 3).map((booking) => {
          const isPending = !booking.driver;
          return (
            <View key={booking._id} style={styles.recentBookingCard}>
              <View style={styles.bookingCardHeader}>
                <View>
                  <Text style={styles.bookingId}>
                    #{booking.bookingId || booking._id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={styles.bookingType}>
                    {booking.vehicleType || 'Truck'} · {booking.goods || 'General Cargo'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bookingFare}>
                    ₹{booking.finalFare || booking.estimatedFare || 0}
                  </Text>
                  <StatusBadge
                    status={booking.assignmentStatus || booking.bookingStatus}
                    size="sm"
                  />
                </View>
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.green }]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {booking.pickup?.address || 'Pickup address'}
                  </Text>
                </View>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: theme.colors.accent }]} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {booking.drop?.address || 'Drop address'}
                  </Text>
                </View>
              </View>

              {isPending ? (
                <Pressable
                  onPress={() => onNavigateTab('Bookings')}
                  style={styles.assignShortcutBtn}
                >
                  <Text style={styles.assignShortcutText}>Assign Driver & Truck &rarr;</Text>
                </Pressable>
              ) : (
                <Text style={styles.assignedDriverNote}>
                  Assigned: {booking.driver?.fullName || booking.driver?.name || 'Driver'} ({booking.vehicle?.vehicleNumber || 'Truck'})
                </Text>
              )}
            </View>
          );
        })
      )}

      {/* 6. APPROVAL BOUNDARIES NOTICE */}
      <View style={styles.noticeCard}>
        <View style={styles.noticeHeader}>
          <Ionicons name="shield-checkmark" size={18} color={theme.colors.primary} />
          <Text style={styles.noticeTitle}>Agency Workflow Boundary</Text>
        </View>
        <Text style={styles.noticeText}>
          &bull; Agency acceptance confirms driver association with your agency. Super Admin independently approves driver Aadhaar, Driving Licence, and platform dispatch.
        </Text>
        <Text style={styles.noticeText}>
          &bull; When you assign a trip to a driver, the assignment remains pending until the driver accepts it on their Driver App.
        </Text>
      </View>
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
    gap: 16
  },
  welcomeCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 18,
    gap: 12
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  welcomeSubtitle: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  welcomeTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2
  },
  welcomeDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19
  },
  rejectionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dangerGlow,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    padding: 10,
    borderRadius: theme.borderRadius.md
  },
  rejectionText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  kycProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    gap: 10,
    marginTop: 2
  },
  kycProgressLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  kycProgressCount: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.card,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  seeAllText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700'
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }]
  },
  actionIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnText: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center'
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  emptyTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '800'
  },
  emptySubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: 'center'
  },
  recentBookingCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 10
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  bookingId: {
    color: theme.colors.teal,
    fontSize: 13,
    fontWeight: '800'
  },
  bookingType: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  bookingFare: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '800'
  },
  routeContainer: {
    gap: 6,
    paddingVertical: 2
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  routeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    flex: 1
  },
  assignShortcutBtn: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  assignShortcutText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800'
  },
  assignedDriverNote: {
    color: theme.colors.muted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2
  },
  noticeCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 8
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  noticeTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: '800'
  },
  noticeText: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16
  }
});
