import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, Status } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function BookingSuccessScreen({ route, navigation }) {
  const booking = route.params?.booking;

  if (!booking) {
    return (
      <Screen>
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Booking Information Unavailable</Text>
          <Button
            title="View My Bookings"
            onPress={() => navigation.navigate("MainTabs", { screen: "Bookings" })}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.successHeader}>
        <View style={styles.iconBadge}>
          <Ionicons name="checkmark-circle" size={54} color={colors.primary} />
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your goods transport request has been registered with LoadBalbin.
        </Text>
      </View>

      <Card style={styles.detailsCard}>
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.bookingIdLabel}>Booking ID</Text>
            <Text style={styles.bookingIdValue}>{booking.bookingId}</Text>
          </View>
          <Status value={booking.bookingStatus} />
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estimated Total Fare</Text>
          <Text style={styles.infoFare}>₹{booking.estimatedFare}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle Assigned</Text>
          <Text style={styles.infoValue}>
            {booking.vehicle?.vehicleModel ||
              booking.vehicleType?.replace(/-/g, " ") ||
              "Standard Fleet"}
          </Text>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={13} color={colors.primary} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.pickup?.address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Ionicons name="location" size={13} color={colors.danger} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.drop?.address}
            </Text>
          </View>
        </View>

        <View style={styles.paymentBadgeRow}>
          <Text style={styles.paymentLabel}>Payment Status:</Text>
          <Text style={styles.paymentVal}>{booking.paymentStatus || "Pending"}</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Track Booking Details"
          icon={<Ionicons name="receipt-outline" size={16} color={colors.white} />}
          onPress={() =>
            navigation.replace("BookingDetails", { bookingId: booking._id })
          }
        />

        <Button
          title="Back to Home"
          secondary
          onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  successHeader: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16
  },
  iconBadge: {
    marginBottom: 4
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 20
  },
  detailsCard: {
    padding: 18,
    gap: 12
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  bookingIdLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  bookingIdValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  infoFare: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  routeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
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
  paymentBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 8
  },
  paymentLabel: {
    color: colors.textMuted,
    fontSize: 12
  },
  paymentVal: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  actions: {
    gap: 10,
    marginTop: 8
  },
  errorCard: {
    padding: 24,
    gap: 14,
    alignItems: "center"
  },
  errorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  }
});
