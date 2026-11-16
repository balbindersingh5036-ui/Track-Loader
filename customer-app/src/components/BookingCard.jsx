import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card, Status, colors } from "./Phase12UI";
import EVBadge from "./EVBadge";

export default function BookingCard({ booking, onPress }) {
  if (!booking) return null;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: colors.textLight, fontSize: 17, fontWeight: "700" }}>{booking.bookingId || "Booking"}</Text>
            <EVBadge vehicle={booking} size="small" />
          </View>
          <Status value={booking.bookingStatus} assignmentStatus={booking.assignmentStatus} assigned={Boolean(booking.driver)} />
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
