import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import bookingService from "../../services/bookingService";
import configService from "../../services/configService";
import paymentService from "../../services/paymentService";
import ratingService from "../../services/ratingService";
import { joinBookingRoom, subscribeToBookingEvents } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Field, Heading, Loading, Notice, Screen, Status, styles } from "../../components/Phase12UI";

export default function BookingDetailsScreen({ route, navigation }) {
  const bookingId = route.params?.bookingId || route.params?.id;
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("");
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
          setHasRating(Boolean(await ratingService.getBookingRating(currentBooking._id)));
        } catch (ratingError) {
          setError(getErrorMessage(ratingError));
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

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (!booking) return undefined;
    const unsubscribe = subscribeToBookingEvents((eventName, payload) => {
      if (booking && (payload?.bookingId === booking.bookingId || payload?.bookingId === booking._id)) load();
    });
    return unsubscribe;
  }, [booking?._id, booking?.bookingId, load]);

  const cancel = async () => {
    if (!booking || busy) return;
    setBusy(true);
    Alert.alert("Cancel booking?", "The server will confirm whether this booking can still be cancelled.", [
      {
        text: "Keep booking",
        style: "cancel",
        onPress: () => setBusy(false)
      },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          setError("");
          try {
            setBooking(await bookingService.cancelBooking(booking._id, reason.trim()));
          } catch (requestError) {
            setError(getErrorMessage(requestError));
          } finally {
            setBusy(false);
          }
        }
      }
    ], { cancelable: true, onDismiss: () => setBusy(false) });
  };

  const createPaymentOrder = async () => {
    if (!booking || busy) return;
    setBusy(true);
    setError("");
    setPaymentInfo(null);
    try {
      const payment = await paymentService.createOrder(booking._id);
      setPaymentInfo(payment);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen><Loading label="Loading booking details..." /></Screen>;
  if (!booking) {
    return (
      <Screen>
        <Notice message={error || "Booking details could not be loaded."} />
        <Button title="Retry" secondary onPress={() => { setLoading(true); load(); }} />
      </Screen>
    );
  }

  const canCancel = ["pending", "accepted"].includes(booking.bookingStatus);
  return (
    <Screen>
      <Heading title={booking.bookingId} subtitle="Booking details from the LoadBalbin service." />
      {error ? <Notice message={error} /> : null}
      <Card>
        <Status value={booking.bookingStatus} />
        <Text style={styles.muted}>Pickup: {booking.pickup?.address}</Text>
        <Text style={styles.muted}>Drop-off: {booking.drop?.address}</Text>
        <Text style={styles.muted}>Goods: {booking.goods}</Text>
        <Text style={styles.muted}>Weight: {booking.weight?.value} {booking.weight?.unit}</Text>
        <Text style={styles.muted}>Pickup date/time: {booking.preferredPickupDate ? new Date(booking.preferredPickupDate).toLocaleDateString() : "—"} · {booking.preferredPickupTime}</Text>
        <Text style={styles.muted}>Vehicle: {booking.vehicle?.vehicleModel || booking.vehicleType?.replaceAll("-", " ") || "Not assigned"}</Text>
        <Text style={styles.muted}>Driver: {booking.driver?.fullName || booking.driver?.phone || "Not assigned"}</Text>
        <Text style={styles.muted}>Estimated fare: ₹{booking.estimatedFare}</Text>
        <Text style={styles.muted}>Final fare: {booking.finalFare ? `₹${booking.finalFare}` : "Not finalised"}</Text>
        <Text style={styles.muted}>Payment: {paymentStatus?.paymentStatus || booking.paymentStatus}</Text>
      </Card>

      {canCancel ? (
        <Card>
          <Field label="Cancellation reason (optional)" value={reason} onChangeText={setReason} multiline />
          <Button title="Cancel booking" secondary loading={busy} onPress={cancel} />
        </Card>
      ) : null}

      {booking.bookingStatus === "completed" && booking.driver ? (
        <Card>
          <Text style={styles.cardTitle}>Rate your delivery</Text>
          {hasRating ? (
            <Text style={styles.muted}>This booking has already been rated.</Text>
          ) : (
            <Button title="Submit a rating" onPress={() => navigation.navigate("Rating", { bookingId: booking._id })} />
          )}
        </Card>
      ) : null}

      {paymentEnabled && !["paid", "cash"].includes(booking.paymentStatus) ? (
        <Card>
          <Text style={styles.cardTitle}>Online payment</Text>
          <Text style={styles.muted}>Create a payment order securely through the backend. Checkout is not available until a compatible native Razorpay checkout is configured.</Text>
          <Button title="Create payment order" loading={busy} onPress={createPaymentOrder} />
          {paymentInfo ? (
            <Text style={styles.muted}>
              Order created · ₹{(paymentInfo.amount / 100).toFixed(2)} {paymentInfo.currency} · {paymentInfo.orderId}
            </Text>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
