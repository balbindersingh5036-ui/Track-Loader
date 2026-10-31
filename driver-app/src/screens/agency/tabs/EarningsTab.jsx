import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';

export default function EarningsTab({
  bookings = [],
  loading = false,
  refreshing = false,
  onRefresh,
  onSelectBooking
}) {
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'month' | 'week'

  // Completed bookings
  const completedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'completed');
  }, [bookings]);

  // Filtered by period
  const filteredBookings = useMemo(() => {
    if (filterPeriod === 'all') return completedBookings;
    const now = new Date();
    return completedBookings.filter((b) => {
      const tripDate = new Date(b.createdAt || b.updatedAt || b.preferredPickupDate);
      if (filterPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return tripDate >= weekAgo;
      }
      if (filterPeriod === 'month') {
        return (
          tripDate.getMonth() === now.getMonth() &&
          tripDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [completedBookings, filterPeriod]);

  // Total Gross Volume
  const totalVolume = useMemo(() => {
    return filteredBookings.reduce((sum, b) => {
      const fare = Number(b.finalFare || b.estimatedFare || 0);
      return sum + fare;
    }, 0);
  }, [filteredBookings]);

  // Average Fare
  const avgFare = useMemo(() => {
    if (filteredBookings.length === 0) return 0;
    return Math.round(totalVolume / filteredBookings.length);
  }, [totalVolume, filteredBookings.length]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {/* 1. HERO EARNINGS / ORDER VOLUME CARD */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIconBubble}>
            <Ionicons name="wallet" size={24} color={theme.colors.green} />
          </View>
          <View style={styles.badgeContainer}>
            <Text style={styles.heroBadgeText}>Completed Volume</Text>
          </View>
        </View>

        <Text style={styles.heroAmount}>
          ₹{totalVolume.toLocaleString('en-IN')}
        </Text>
        <Text style={styles.heroSubtitle}>
          Gross order value from {filteredBookings.length} completed trip{filteredBookings.length === 1 ? '' : 's'}
        </Text>

        <View style={styles.statsDivider} />

        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statColLabel}>Completed Trips</Text>
            <Text style={styles.statColValue}>{filteredBookings.length}</Text>
          </View>
          <View style={styles.statColBorder} />
          <View style={styles.statCol}>
            <Text style={styles.statColLabel}>Average Fare</Text>
            <Text style={styles.statColValue}>₹{avgFare.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* 2. REGULATORY & PLATFORM DISCLAIMER */}
      <View style={styles.disclaimerCard}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.disclaimerTitle}>Billing Volume Notice</Text>
          <Text style={styles.disclaimerText}>
            Values displayed represent customer billing volumes completed by your fleet. Official driver commissions and platform fee reconciliations are disbursed through scheduled settlement cycles.
          </Text>
        </View>
      </View>

      {/* 3. TIME PERIOD FILTERS */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>Trip History</Text>
        <View style={styles.filterChipsRow}>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'month', label: 'This Month' },
            { id: 'week', label: 'Last 7 Days' }
          ].map((chip) => {
            const active = filterPeriod === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setFilterPeriod(chip.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4. COMPLETED TRIPS LIST */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No Completed Trips"
          description={
            filterPeriod === 'all'
              ? 'No trips have been completed by your drivers yet. When drivers finish bookings, they will appear here.'
              : 'No completed trips found for the selected time filter.'
          }
          actionLabel={filterPeriod !== 'all' ? 'Show All Trips' : undefined}
          onAction={filterPeriod !== 'all' ? () => setFilterPeriod('all') : undefined}
        />
      ) : (
        <View style={styles.tripsList}>
          {filteredBookings.map((b) => {
            const fare = Number(b.finalFare || b.estimatedFare || 0);
            const dateStr = b.preferredPickupDate
              ? new Date(b.preferredPickupDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })
              : 'Recent';

            return (
              <Pressable
                key={b._id}
                onPress={() => onSelectBooking && onSelectBooking(b)}
                style={styles.tripCard}
              >
                <View style={styles.tripHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingId}>#{b.bookingId || b._id?.slice(-8)}</Text>
                    <Text style={styles.tripDate}>{dateStr}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.tripFare}>₹{fare.toLocaleString('en-IN')}</Text>
                    <StatusBadge status="completed" label="Completed" size="sm" />
                  </View>
                </View>

                {/* ROUTE SUMMARY */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeRow}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.green }]} />
                    <Text style={styles.routeAddress} numberOfLines={1}>
                      {b.pickup?.address || 'Pickup location'}
                    </Text>
                  </View>
                  <View style={styles.routeRow}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
                    <Text style={styles.routeAddress} numberOfLines={1}>
                      {b.drop?.address || 'Drop location'}
                    </Text>
                  </View>
                </View>

                {/* TRIP METADATA */}
                <View style={styles.tripMetaRow}>
                  <View style={styles.metaBadge}>
                    <Ionicons name="person-outline" size={13} color={theme.colors.muted} />
                    <Text style={styles.metaBadgeText} numberOfLines={1}>
                      {b.driver?.fullName || 'Assigned Driver'}
                    </Text>
                  </View>

                  <View style={styles.metaBadge}>
                    <Ionicons name="car-outline" size={13} color={theme.colors.muted} />
                    <Text style={styles.metaBadgeText} numberOfLines={1}>
                      {b.vehicle?.vehicleNumber || 'Vehicle'}
                    </Text>
                  </View>

                  {b.paymentStatus ? (
                    <View style={styles.metaBadge}>
                      <Ionicons name="card-outline" size={13} color={theme.colors.muted} />
                      <Text style={[styles.metaBadgeText, { textTransform: 'capitalize' }]}>
                        {b.paymentStatus}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.bg
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.md
  },
  heroCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  heroIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${theme.colors.green}18`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeContainer: {
    backgroundColor: `${theme.colors.green}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full
  },
  heroBadgeText: {
    color: theme.colors.green,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  heroAmount: {
    color: theme.colors.ink,
    fontSize: 32,
    fontWeight: theme.typography.weights.extrabold,
    letterSpacing: -0.5
  },
  heroSubtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.sm,
    marginTop: 2
  },
  statsDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statCol: {
    flex: 1,
    alignItems: 'center'
  },
  statColLabel: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 4
  },
  statColValue: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold
  },
  statColBorder: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border
  },
  disclaimerCard: {
    flexDirection: 'row',
    backgroundColor: `${theme.colors.accent}12`,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}40`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'flex-start'
  },
  disclaimerTitle: {
    color: theme.colors.accent,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2
  },
  disclaimerText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18
  },
  filterSection: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  filterChipText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  filterChipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.typography.weights.bold
  },
  tripsList: {
    gap: theme.spacing.sm
  },
  tripCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  bookingId: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold
  },
  tripDate: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2
  },
  tripFare: {
    color: theme.colors.green,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.extrabold
  },
  routeContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    gap: 6
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  routeAddress: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.xs
  },
  tripMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 2
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.xs,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  metaBadgeText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    maxWidth: 140
  }
});
