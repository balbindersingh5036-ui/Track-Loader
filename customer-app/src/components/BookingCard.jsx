import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card, Status, colors } from "./Phase12UI";

export default function BookingCard({ booking, onPress }) {
  if (!booking) return null;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ color: colors.textLight, fontSize: 17, fontWeight: "700" }}>{booking.bookingId || "Booking"}</Text>
          <Status value={booking.bookingStatus} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>
          {booking.pickup?.address || "Pickup not set"} → {booking.drop?.address || "Drop not set"}
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          Estimated fare: {booking.estimatedFare ? `₹${booking.estimatedFare}` : "Pending"}
        </Text>
      </Card>
    </Pressable>
  );
}

