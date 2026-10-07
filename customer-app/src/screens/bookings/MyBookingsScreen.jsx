import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  ScrollView,
  StyleSheet
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import bookingService from "../../services/bookingService";
import { joinBookingRoom, subscribeToBookingEvents } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, Status } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

const filterTabs = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Accepted", value: "accepted" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rejected", value: "rejected" }
];

export default function MyBookingsScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await bookingService.getMyBookings({ limit: 100 });
      setBookings(result.bookings || []);
      result.bookings?.forEach((booking) => joinBookingRoom(booking._id));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToBookingEvents((eventName, payload) => {
      const belongsToLoadedList = bookingsRef.current.some(
        (booking) =>
          booking.bookingId === payload?.bookingId || booking._id === payload?.bookingId
      );
      if (belongsToLoadedList) load();
    });
    return unsubscribe;
  }, [load]);

  const shown = useMemo(
    () => (filter ? bookings.filter((b) => b.bookingStatus === filter) : bookings),
    [bookings, filter]
  );

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Heading
        title="My Bookings"
        subtitle="Manage and track your active and past goods shipments."
        right={
          <Pressable
            style={styles.newBookingBtn}
            onPress={() => navigation.navigate("BookingLocation")}
          >
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.newBookingText}>New</Text>
          </Pressable>
        }
      />

      {/* FILTER TABS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {filterTabs.map((tab) => {
          const active = filter === tab.value;
          const count = tab.value
            ? bookings.filter((b) => b.bookingStatus === tab.value).length
            : bookings.length;

          return (
            <Pressable
              key={tab.label}
              onPress={() => setFilter(tab.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
              {count > 0 ? (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Notice message={error} /> : null}

      {loading ? (
        <Loading label="Loading your bookings..." />
      ) : shown.length === 0 ? (
        <Empty
          title={filter ? `No ${filter} bookings` : "No bookings yet"}
          detail={
            filter
              ? "Try switching to another tab to view other bookings."
              : "Create your first transport request to start moving goods."
          }
          actionTitle="Book a transport"
          onAction={() => navigation.navigate("BookingLocation")}
        />
      ) : (
        <View style={styles.list}>
          {shown.map((booking) => (
            <Pressable
              key={booking._id}
              style={[styles.bookingCard, shadows.soft]}
              onPress={() =>
                navigation.navigate("BookingDetails", { bookingId: booking._id })
              }
            >
              <View style={styles.bookingTopRow}>
                <View>
                  <Text style={styles.bookingId}>{booking.bookingId}</Text>
                  <Text style={styles.vehicleType}>
                    {booking.vehicle?.vehicleModel ||
                      booking.vehicleType?.replace(/-/g, " ") ||
                      "Fleet Vehicle"}
                  </Text>
                </View>
                <Status value={booking.bookingStatus} />
              </View>

              <View style={styles.routeBox}>
                <View style={styles.routeRow}>
                  <Ionicons name="radio-button-on" size={13} color={colors.primary} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {booking.pickup?.address || "Pickup"}
                  </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                  <Ionicons name="location" size={13} color={colors.danger} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {booking.drop?.address || "Drop-off"}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingBottomRow}>
                <View>
                  <Text style={styles.fareLabel}>Estimated Fare</Text>
                  <Text style={styles.fareValue}>₹{booking.estimatedFare}</Text>
                </View>

                <View style={styles.detailsBtn}>
                  <Text style={styles.detailsBtnText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  newBookingBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4
  },
  newBookingText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700"
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: "700"
  },
  countBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  countBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)"
  },
  countText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700"
  },
  countTextActive: {
    color: colors.white
  },
  list: {
    gap: 12
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12
  },
  bookingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  bookingId: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  vehicleType: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize",
    marginTop: 1
  },
  routeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  routeLine: {
    width: 1,
    height: 10,
    backgroundColor: colors.line,
    marginLeft: 6
  },
  routeText: {
    flex: 1,
    color: colors.textLight,
    fontSize: 12,
    fontWeight: "500"
  },
  bookingBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10
  },
  fareLabel: {
    color: colors.textMuted,
    fontSize: 11
  },
  fareValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  detailsBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
