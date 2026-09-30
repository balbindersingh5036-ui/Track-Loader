import React from "react";
import { Text } from "react-native";
import { Card, Heading, Screen } from "../../components/Phase12UI";

export default function BookingReceiptScreen({ route }) {
  const booking = route.params?.booking || {};

  return (
    <Screen>
      <Heading title="Booking receipt" subtitle="Summary of your transport booking." />
      <Card>
        <Text>Booking ID: {booking.bookingId || "Not available"}</Text>
        <Text>Status: {booking.bookingStatus || "Pending"}</Text>
        <Text>Estimated fare: ₹{booking.estimatedFare || 0}</Text>
        <Text>Payment status: {booking.paymentStatus || "Pending"}</Text>
      </Card>
    </Screen>
  );
}

