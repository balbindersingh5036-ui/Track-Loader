import React from "react";
import { Text } from "react-native";
import { Button, Card, Heading, Screen, Status, styles } from "../../components/Phase12UI";

export default function BookingSuccessScreen({ route, navigation }) {
  const booking = route.params?.booking;
  if (!booking) {
    return (
      <Screen>
        <Heading title="Booking details unavailable" />
        <Button title="View my bookings" onPress={() => navigation.navigate("MainTabs", { screen: "Bookings" })} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading title="Booking request created" subtitle="Your request was saved by LoadBalbin." />
      <Card>
        <Text style={styles.cardTitle}>{booking.bookingId}</Text>
        <Status value={booking.bookingStatus} />
        <Text style={styles.muted}>Estimated fare: ₹{booking.estimatedFare}</Text>
        <Text style={styles.muted}>Vehicle: {booking.vehicle?.vehicleModel || booking.vehicleType?.replaceAll("-", " ")}</Text>
        <Text style={styles.muted}>Pickup: {booking.pickup?.address}</Text>
        <Text style={styles.muted}>Drop-off: {booking.drop?.address}</Text>
        <Text style={styles.muted}>Payment: {booking.paymentStatus}</Text>
      </Card>
      <Button title="View booking" onPress={() => navigation.replace("BookingDetails", { bookingId: booking._id })} />
      <Button title="Back to home" secondary onPress={() => navigation.navigate("MainTabs", { screen: "Home" })} />
    </Screen>
  );
}
