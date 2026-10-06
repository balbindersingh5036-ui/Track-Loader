import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Heading, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function FareScreen({ route, navigation }) {
  const { totalFare, weight, distance, vehicleType } = route.params || {};

  return (
    <Screen>
      <Heading
        title="Authoritative Fare Estimate"
        subtitle="Server-calculated transportation rate breakdown."
      />

      <Card style={styles.fareCard}>
        <View style={styles.badgeRow}>
          <View style={styles.vehiclePill}>
            <Text style={styles.vehiclePillText}>
              {vehicleType ? vehicleType.replace(/-/g, " ") : "Standard Logistics"}
            </Text>
          </View>
        </View>

        <Text style={styles.fareTitle}>Estimated Total Fare</Text>
        <Text style={styles.fareAmount}>
          ₹{Number(totalFare || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
            <Text style={styles.detailLabel}>Estimated Weight</Text>
            <Text style={styles.detailValue}>{weight ? `${weight} kg` : "—"}</Text>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.detailLabel}>Estimated Distance</Text>
            <Text style={styles.detailValue}>{distance ? `${distance} km` : "Calculated on route"}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.infoText} />
          <Text style={styles.infoText}>
            Fare includes base fee, distance rates, and applicable handling charges.
          </Text>
        </View>
      </Card>

      <Button
        title="Return to Booking"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 10 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fareCard: {
    padding: 20,
    gap: 12
  },
  badgeRow: {
    flexDirection: "row"
  },
  vehiclePill: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  vehiclePillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  fareTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  fareAmount: {
    color: colors.navy,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight,
    marginVertical: 4
  },
  detailRow: {
    flexDirection: "row",
    gap: 16
  },
  detailItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 4
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500"
  },
  detailValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: "700"
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.infoBg,
    borderRadius: 8,
    padding: 10,
    gap: 8
  },
  infoText: {
    flex: 1,
    color: colors.infoText,
    fontSize: 12,
    lineHeight: 16
  }
});
