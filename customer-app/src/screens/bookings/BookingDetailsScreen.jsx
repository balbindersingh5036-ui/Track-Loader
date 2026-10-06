import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, View, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import bookingService from "../../services/bookingService";
import configService from "../../services/configService";
import paymentService from "../../services/paymentService";
import ratingService from "../../services/ratingService";
import { joinBookingRoom, subscribeToBookingEvents } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Field, Heading, Loading, Notice, Screen, Status } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function BookingDetailsScreen({ route, navigation }) {
  const bookingId = route.params?.bookingId || route.params?.id;
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("");
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [hasRating, setHasRating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const currentBooking = await bookingService.getBooking(bookingId);
      setBooking(currentBooking);
      joinBookingRoom(currentBooking._id);

      if (currentBooking.bookingStatus === "completed" && currentBooking.driver) {
        try {
          const ratingData = await ratingService.getBookingRating(currentBooking._id);
          setHasRating(Boolean(ratingData));
        } catch (ratingError) {
          // ignore rating 404
        }
      } else {
        setHasRating(false);
      }

      const config = await configService.getPublicConfig();
      const isPaymentEnabled = config["payment.enabled"] === true;
      setPaymentEnabled(isPaymentEnabled);

      if (isPaymentEnabled) {
        try {
          setPaymentStatus(await paymentService.getPaymentStatus(currentBooking._id));
        } catch (paymentError) {
          if (paymentError?.response?.status !== 404) throw paymentError;
          setPaymentStatus(null);
        }
      } else {
        setPaymentStatus(null);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!booking) return undefined;
    const unsubscribe = subscribeToBookingEvents((eventName, payload) => {
      if (
        booking &&
        (payload?.bookingId === booking.bookingId || payload?.bookingId === booking._id)
      ) {
        load();
      }
    });
    return unsubscribe;
  }, [booking?._id, booking?.bookingId, load]);

  const cancel = async () => {
    if (!booking || busy) return;
    setBusy(true);
    Alert.alert(
      "Cancel Booking?",
      "Are you sure you want to cancel this transport request?",
      [
        { text: "Keep Booking", style: "cancel", onPress: () => setBusy(false) },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setError("");
            try {
              const updated = await bookingService.cancelBooking(booking._id, reason.trim());
              setBooking(updated);
              setShowCancelInput(false);
            } catch (requestError) {
              setError(getErrorMessage(requestError));
            } finally {
              setBusy(false);
            }
          }
        }
      ],
      { cancelable: true, onDismiss: () => setBusy(false) }
    );
  };

  const createPaymentOrder = async () => {
    if (!booking || busy) return;
    setBusy(true);
    setError("");
    try {
      const order = await paymentService.createOrder(booking._id);
      setPaymentInfo(order);
      Alert.alert(
        "Payment Order Created",
        `Order ID: ${order.orderId || "Pending"}\nAmount: ₹${order.amount || booking.estimatedFare}\n\nPlease proceed via online payment gateway.`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading booking details..." />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <Card style={{ padding: 24, alignItems: "center" }}>
          <Text style={{ color: colors.navy, fontSize: 16, fontWeight: "700" }}>
            Booking not found
          </Text>
          <Button
            title="Back to Bookings"
            onPress={() => navigation.navigate("MainTabs", { screen: "Bookings" })}
            style={{ marginTop: 12 }}
          />
        </Card>
      </Screen>
    );
  }

  const isCancellable = ["pending", "accepted"].includes(booking.bookingStatus);
  const isCompleted = booking.bookingStatus === "completed";

  return (
    <Screen>
      {/* HEADER CARD */}
      <Card style={styles.headerCard}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.bookingId}>{booking.bookingId}</Text>
            <Text style={styles.bookingDate}>
              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : ""}
            </Text>
          </View>
          <Status value={booking.bookingStatus} />
        </View>

        <View style={styles.divider} />

        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Estimated Total</Text>
          <Text style={styles.fareValue}>₹{booking.estimatedFare}</Text>
        </View>
      </Card>

      {/* ROUTE CARD */}
      <Card>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Route</Text>
          <Ionicons name="map-outline" size={16} color={colors.primary} />
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup Location</Text>
              <Text style={styles.routeText}>{booking.pickup?.address}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeItem}>
            <Ionicons name="location" size={14} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Drop-Off Location</Text>
              <Text style={styles.routeText}>{booking.drop?.address}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* DRIVER & VEHICLE INFO */}
      <Card>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Driver & Vehicle</Text>
          <MaterialCommunityIcons name="truck-outline" size={18} color={colors.primary} />
        </View>

        {booking.driver ? (
          <View style={styles.driverInfoBox}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {booking.driver.fullName || booking.driver.name || "Assigned Driver"}
              </Text>
              <Text style={styles.driverPhone}>
                {booking.driver.phone || "Phone provided on dispatch"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.unassignedBox}>
            <Ionicons name="hourglass-outline" size={18} color={colors.muted} />
            <Text style={styles.unassignedText}>
              Driver assignment is in progress. You will be notified once a driver accepts.
            </Text>
          </View>
        )}

        <View style={styles.vehicleInfoRow}>
          <Text style={styles.infoLabel}>Vehicle Model:</Text>
          <Text style={styles.infoValue}>
            {booking.vehicle?.vehicleModel ||
              booking.vehicleType?.replace(/-/g, " ") ||
              "Fleet Standard"}
          </Text>
        </View>

        {booking.vehicle?.vehicleNumber ? (
          <View style={styles.vehicleInfoRow}>
            <Text style={styles.infoLabel}>Vehicle Number:</Text>
            <Text style={styles.infoValue}>{booking.vehicle.vehicleNumber}</Text>
          </View>
        ) : null}
      </Card>

      {/* CARGO & SCHEDULE */}
      <Card>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Cargo Information</Text>
          <Ionicons name="cube-outline" size={16} color={colors.primary} />
        </View>

        <View style={styles.cargoGrid}>
          <View style={styles.cargoItem}>
            <Text style={styles.cargoLabel}>Goods</Text>
            <Text style={styles.cargoVal}>{booking.goods || "General cargo"}</Text>
          </View>
          <View style={styles.cargoItem}>
            <Text style={styles.cargoLabel}>Weight</Text>
            <Text style={styles.cargoVal}>
              {booking.weight?.value || 0} {booking.weight?.unit || "kg"}
            </Text>
          </View>
        </View>

        {booking.preferredPickupDate ? (
          <View style={styles.cargoGrid}>
            <View style={styles.cargoItem}>
              <Text style={styles.cargoLabel}>Pickup Date</Text>
              <Text style={styles.cargoVal}>{booking.preferredPickupDate}</Text>
            </View>
            <View style={styles.cargoItem}>
              <Text style={styles.cargoLabel}>Pickup Time</Text>
              <Text style={styles.cargoVal}>{booking.preferredPickupTime || "—"}</Text>
            </View>
          </View>
        ) : null}

        {booking.customerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Note:</Text>
            <Text style={styles.noteVal}>{booking.customerNote}</Text>
          </View>
        ) : null}
      </Card>

      {error ? <Notice message={error} /> : null}

      {/* ACTIONS */}
      <View style={styles.actionContainer}>
        {/* VIEW RECEIPT */}
        <Button
          title="View Receipt / Invoice"
          secondary
          icon={<Ionicons name="document-text-outline" size={16} color={colors.primary} />}
          onPress={() => navigation.navigate("BookingReceipt", { booking })}
        />

        {/* RATE DRIVER IF COMPLETED */}
        {isCompleted && !hasRating ? (
          <Button
            title="Rate Delivery Experience"
            icon={<Ionicons name="star" size={16} color={colors.white} />}
            onPress={() => navigation.navigate("Rating", { bookingId: booking._id })}
          />
        ) : null}

        {/* ONLINE PAYMENT IF ENABLED */}
        {paymentEnabled && booking.paymentStatus !== "completed" ? (
          <Button
            title="Pay Online"
            loading={busy}
            icon={<Ionicons name="card-outline" size={16} color={colors.white} />}
            onPress={createPaymentOrder}
          />
        ) : null}

        {/* CANCEL BOOKING (IF PERMITTED) */}
        {isCancellable ? (
          <View style={styles.cancelSection}>
            {showCancelInput ? (
              <View style={styles.cancelForm}>
                <Field
                  label="Cancellation Reason (Optional)"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why do you need to cancel?"
                />
                <View style={styles.cancelBtnRow}>
                  <Button
                    title="Dismiss"
                    secondary
                    onPress={() => setShowCancelInput(false)}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                  <Button
                    title="Confirm Cancel"
                    danger
                    loading={busy}
                    onPress={cancel}
                    style={{ flex: 1, minHeight: 40 }}
                  />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowCancelInput(true)}
                style={styles.cancelTrigger}
              >
                <Text style={styles.cancelTriggerText}>Cancel This Booking</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 16,
    gap: 10
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  bookingId: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: "800"
  },
  bookingDate: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fareLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500"
  },
  fareValue: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: "800"
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700"
  },
  routeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 4
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  routeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500"
  },
  routeText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: colors.line,
    marginLeft: 6,
    marginVertical: 1
  },
  driverInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 12
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  driverName: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: "700"
  },
  driverPhone: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1
  },
  unassignedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 10
  },
  unassignedText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  vehicleInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 13
  },
  infoValue: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  cargoGrid: {
    flexDirection: "row",
    gap: 10
  },
  cargoItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  cargoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500"
  },
  cargoVal: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "700"
  },
  noteBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  noteLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  noteVal: {
    color: colors.ink,
    fontSize: 12,
    fontStyle: "italic"
  },
  actionContainer: {
    gap: 10,
    marginTop: 4
  },
  cancelSection: {
    marginTop: 4
  },
  cancelForm: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: 14,
    gap: 10
  },
  cancelBtnRow: {
    flexDirection: "row",
    gap: 10
  },
  cancelTrigger: {
    alignItems: "center",
    paddingVertical: 10
  },
  cancelTriggerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700"
  }
});
