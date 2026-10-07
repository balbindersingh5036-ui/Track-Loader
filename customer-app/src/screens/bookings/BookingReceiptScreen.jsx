import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { Button, Card, Heading, Screen, Status } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function BookingReceiptScreen({ route, navigation }) {
  const booking = route.params?.booking || {};

  return (
    <Screen>
      <Heading
        title="Booking Receipt"
        subtitle="Official transportation invoice summary."
      />

      <Card style={[styles.receiptCard, shadows.card]}>
        {/* INVOICE HEADER */}
        <View style={styles.invoiceHeader}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="truck-fast" size={20} color={colors.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>LoadBalbin Logistics</Text>
              <Text style={styles.invoiceSub}>Transport Receipt</Text>
            </View>
          </View>
          <Status value={booking.bookingStatus || "pending"} />
        </View>

        <View style={styles.divider} />

        {/* BOOKING META */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Booking Reference</Text>
            <Text style={styles.metaValue}>{booking.bookingId || "—"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>
              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : "—"}
            </Text>
          </View>
        </View>

        {/* ROUTE SECTION */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Route Specifications</Text>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={13} color={colors.primary} />
            <Text style={styles.routeVal} numberOfLines={2}>
              {booking.pickup?.address || "Pickup address not specified"}
            </Text>
          </View>
          <View style={styles.routeItem}>
            <Ionicons name="location" size={13} color={colors.danger} />
            <Text style={styles.routeVal} numberOfLines={2}>
              {booking.drop?.address || "Drop address not specified"}
            </Text>
          </View>
        </View>

        {/* CARGO & VEHICLE SECTION */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Transport Details</Text>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Vehicle:</Text>
            <Text style={styles.specVal}>
              {booking.vehicle?.vehicleModel ||
                booking.vehicleType?.replace(/-/g, " ") ||
                "Standard Fleet"}
            </Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Cargo Description:</Text>
            <Text style={styles.specVal}>{booking.goods || "General cargo"}</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Total Weight:</Text>
            <Text style={styles.specVal}>
              {booking.weight?.value || 0} {booking.weight?.unit || "kg"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* FARE BREAKDOWN */}
        <View style={styles.fareBreakdown}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Estimated Total Amount</Text>
            <Text style={styles.fareTotal}>₹{booking.estimatedFare || 0}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.paymentStatusLabel}>Payment Status</Text>
            <Text style={styles.paymentStatusVal}>
              {(booking.paymentStatus || "Pending").toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This digital receipt verifies booking initiation. Tax invoices are provided upon journey completion.
        </Text>
      </Card>

      <Button
        title="Back to Booking Details"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  receiptCard: {
    padding: 20,
    gap: 14
  },
  invoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  brandTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  invoiceSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  divider: {
    height: 1,
    backgroundColor: colors.line
  },
  metaGrid: {
    flexDirection: "row",
    gap: 16
  },
  metaItem: {
    flex: 1,
    gap: 2
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  sectionBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 6
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  routeVal: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "600"
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  specKey: {
    color: colors.textMuted,
    fontSize: 12
  },
  specVal: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  fareBreakdown: {
    gap: 6
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fareLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  fareTotal: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  paymentStatusLabel: {
    color: colors.textMuted,
    fontSize: 12
  },
  paymentStatusVal: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  disclaimer: {
    color: colors.textLight,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4
  }
});
