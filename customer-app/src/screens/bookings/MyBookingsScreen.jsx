import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import bookingService from "../../services/bookingService";
import { joinBookingRoom, subscribeToBookingEvents } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, Status, styles, colors } from "../../components/Phase12UI";

const filters = [
  ["All", ""],
  ["Pending", "pending"],
  ["Accepted", "accepted"],
  ["Rejected", "rejected"],
  ["Cancelled", "cancelled"],
  ["In progress", "in-progress"],
  ["Completed", "completed"]
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
      const belongsToLoadedList = bookingsRef.current.some((booking) =>
        booking.bookingId === payload?.bookingId || booking._id === payload?.bookingId
      );
      if (belongsToLoadedList) load();
    });
    return unsubscribe;
  }, [load]);

  const shown = useMemo(
    () => filter ? bookings.filter((booking) => booking.bookingStatus === filter) : bookings,
    [bookings, filter]
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Heading title="My bookings" subtitle="Check the latest status of your transport requests." />
      <Pressable onPress={() => navigation.navigate("BookingLocation")}>
        <Text style={styles.link}>+ Create a booking</Text>
      </Pressable>
      <Text style={styles.muted}>Filter</Text>
      <Text style={{ color: colors.ink }}>
        {filters.map(([label, value]) => (
          <Text
            key={label}
            onPress={() => setFilter(value)}
            style={{
              color: filter === value ? colors.primary : colors.muted,
              fontWeight: filter === value ? "800" : "500"
            }}
          >
            {` ${label} ·`}
          </Text>
        ))}
      </Text>
      {error ? <Notice message={error} /> : null}
      {error ? <Button title="Retry" secondary onPress={load} /> : null}
      {loading ? <Loading label="Loading bookings..." /> : shown.length ? shown.map((booking) => (
        <Pressable key={booking._id} onPress={() => navigation.navigate("BookingDetails", { bookingId: booking._id })}>
          <Card>
            <ViewRow>
              <Text style={styles.cardTitle}>{booking.bookingId}</Text>
              <Status value={booking.bookingStatus} />
            </ViewRow>
            <Text style={styles.muted}>{booking.pickup?.address} → {booking.drop?.address}</Text>
            <Text style={styles.muted}>Estimated fare: ₹{booking.estimatedFare}</Text>
            <Text style={styles.link}>View details</Text>
          </Card>
        </Pressable>
      )) : !error ? <Empty title="No bookings in this section" detail="New transport requests will appear here." /> : null}
    </Screen>
  );
}

const ViewRow = ({ children }) => <View style={styles.row}>{children}</View>;
