import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import configService from "../../services/configService";
import bookingService from "../../services/bookingService";
import { Button, Card, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

export default function BookingConfirmScreen({ route, navigation }) {
  const details = route.params || {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const config = await configService.getPublicConfig();
      if (config["booking.enabled"] !== true || config["system.maintenanceMode"] === true) {
        setError("Booking is currently unavailable. Please try again later.");
        return;
      }
      const payload = {
        pickup: details.pickup,
        drop: details.drop,
        goods: details.goods,
        weight: details.weight,
        preferredPickupDate: details.preferredPickupDate,
        preferredPickupTime: details.preferredPickupTime,
        vehicleType: details.vehicleType
      };
      if (details.vehicleId) payload.vehicle = details.vehicleId;
      if (details.customerNote) payload.customerNote = details.customerNote;

      const booking = await bookingService.createBooking(payload);
      navigation.replace("BookingSuccess", { booking });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading
        title="Review Your Booking"
        subtitle="Confirm all transportation details before submitting your request."
      />

      {/* ROUTE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Route Information</Text>
          <Ionicons name="map-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeRoleLabel}>Pickup Location</Text>
              <Text style={styles.routeAddressText}>{details.pickup?.address}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeItem}>
            <Ionicons name="location" size={14} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeRoleLabel}>Drop-Off Location</Text>
              <Text style={styles.routeAddressText}>{details.drop?.address}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* GOODS & SCHEDULE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Cargo & Schedule</Text>
          <Ionicons name="cube-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Cargo</Text>
            <Text style={styles.gridValue}>{details.goods}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Weight</Text>
            <Text style={styles.gridValue}>
              {details.weight?.value} {details.weight?.unit}
            </Text>
          </View>
        </View>

        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Pickup Date</Text>
            <Text style={styles.gridValue}>{details.preferredPickupDate}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Pickup Time</Text>
            <Text style={styles.gridValue}>{details.preferredPickupTime}</Text>
          </View>
        </View>

        {details.customerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Driver Note:</Text>
            <Text style={styles.noteText}>{details.customerNote}</Text>
          </View>
        ) : null}
      </Card>

      {/* VEHICLE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Vehicle Assignment</Text>
          <MaterialCommunityIcons name="truck-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIconBadge}>
            <MaterialCommunityIcons name="truck-fast" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleTitle}>
              {details.vehicle?.vehicleModel || "Automatic Driver Assignment"}
            </Text>
            <Text style={styles.vehicleSubtitle}>
              Category: {details.vehicleType?.replace(/-/g, " ")}
            </Text>
          </View>
        </View>
      </Card>

      <Notice message={error} />

      <Button
        title="Confirm & Submit Request"
        icon={<Ionicons name="checkmark-circle" size={18} color={colors.white} />}
        loading={busy}
        onPress={submit}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  cardHeaderTitle: {
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
  routeRoleLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  routeAddressText: {
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
  grid2: {
    flexDirection: "row",
    gap: 12
  },
  gridItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  gridLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500"
  },
  gridValue: {
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
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontStyle: "italic"
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  vehicleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  vehicleTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700"
  },
  vehicleSubtitle: {
    color: colors.muted,
    fontSize: 12,
    textTransform: "capitalize",
    marginTop: 1
  }
});
