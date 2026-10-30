import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import { Button, Card, Empty, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

export default function VehicleSelectionScreen({ route, navigation }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(route.params?.vehicleId || "");
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vehicleService
      .getVehicles(route.params?.vehicleType ? { vehicleType: route.params.vehicleType } : {})
      .then(setVehicles)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [route.params?.vehicleType]);

  const continueToConfirm = () => {
    const selected = vehicles.find((vehicle) => vehicle._id === selectedId);
    const selectedAgency = selected?.agency?._id || (selected?.agency ? selected.agency : selectedAgencyId);
    navigation.navigate("BookingConfirm", {
      ...route.params,
      vehicleType: selected?.vehicleType || route.params?.vehicleType || "mini-truck",
      vehicleId: selectedId || null,
      agencyId: selectedAgency || null,
      vehicle: selected || (selectedId ? { vehicleModel: route.params?.vehicle?.vehicleModel || "Requested Vehicle" } : null)
    });
  };

  const requestedWeightKg = route.params?.weight?.unit === "ton"
    ? Number(route.params.weight.value || 0) * 1000
    : Number(route.params?.weight?.value || 0);
  const cargoCompatibleVehicles = vehicles.filter((vehicle) => {
    const capacityKg = vehicle.loadCapacity?.unit === "ton"
      ? Number(vehicle.loadCapacity.value || 0) * 1000
      : Number(vehicle.loadCapacity?.value || 0);
    return capacityKg >= requestedWeightKg;
  });
  const agencies = [...new Map(
    cargoCompatibleVehicles
      .filter((vehicle) => vehicle.agency?._id && vehicle.agency.approvalStatus === "approved" && vehicle.agency.isActive)
      .map((vehicle) => [vehicle.agency._id, vehicle.agency])
  ).values()];

  return (
    <Screen>
      <Heading
        title="Select Vehicle"
        subtitle="Choose an available agency vehicle or ask an approved agency to assign one."
      />

      {/* STEP INDICATOR */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotDone]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
        <Text style={styles.stepLabelDone}>Location</Text>
        <View style={[styles.stepLine, styles.stepLineDone]} />
        <View style={[styles.stepDot, styles.stepDotDone]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
        <Text style={styles.stepLabelDone}>Goods</Text>
        <View style={[styles.stepLine, styles.stepLineDone]} />
        <View style={[styles.stepDot, styles.stepDotActive]}>
          <Text style={styles.stepNumActive}>3</Text>
        </View>
        <Text style={styles.stepLabelActive}>Vehicle</Text>
      </View>

      {error ? <Notice message={error} /> : null}

      {loading ? (
        <Loading label="Loading matching vehicles..." />
      ) : (
        <View style={styles.list}>
          {/* ROUTE TO AGENCY */}
          <Pressable
            style={[
              styles.vehicleOptionCard,
              shadows.soft,
              selectedId === "" && styles.selectedCard
            ]}
            onPress={() => { setSelectedId(""); setSelectedAgencyId(""); }}
          >
            <View style={styles.radioRow}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="account-clock-outline" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Ask an Agency to Assign a Driver</Text>
                <Text style={styles.optionSubtitle}>
                  Select an approved agency. Its admin will assign an eligible driver and vehicle; the driver must then accept your request.
                </Text>
              </View>
              <View style={[styles.radioCircle, selectedId === "" && styles.radioActive]}>
                {selectedId === "" ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
            </View>
          </Pressable>
          {selectedId === "" ? (
            <View style={{ gap: 8, marginLeft: 52 }}>
              {agencies.map((agency) => (
                <Pressable
                  key={agency._id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedAgencyId === agency._id }}
                  onPress={() => setSelectedAgencyId(agency._id)}
                  style={[
                    styles.vehicleOptionCard,
                    selectedAgencyId === agency._id && styles.selectedCard,
                    { padding: 12 }
                  ]}
                >
                  <Text style={styles.optionTitle}>{agency.agencyName || "Transport Agency"}</Text>
                  <Text style={styles.optionSubtitle}>Agency will select a compatible available vehicle.</Text>
                </Pressable>
              ))}
              {agencies.length === 0 ? (
                <Text style={styles.optionSubtitle}>No approved agencies with available vehicles match this vehicle type.</Text>
              ) : null}
            </View>
          ) : null}

          {/* VEHICLE LIST OPTIONS */}
          {cargoCompatibleVehicles.filter((vehicle) => vehicle.agency?._id && vehicle.agency.approvalStatus === "approved" && vehicle.agency.isActive).map((vehicle) => {
            const isSelected = selectedId === vehicle._id;
            return (
              <Pressable
                key={vehicle._id}
                style={[
                  styles.vehicleOptionCard,
                  shadows.soft,
                  isSelected && styles.selectedCard
                ]}
                onPress={() => { setSelectedId(vehicle._id); setSelectedAgencyId(""); }}
              >
                <View style={styles.radioRow}>
                  {vehicle.vehicleImage ? (
                    <Image source={{ uri: vehicle.vehicleImage }} style={styles.thumb} />
                  ) : (
                    <View style={styles.iconBox}>
                      <MaterialCommunityIcons name="truck-outline" size={24} color={colors.primary} />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{vehicle.vehicleModel}</Text>
                    <Text style={styles.optionSubtitle}>
                      {vehicle.vehicleType?.replace(/-/g, " ")} · {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}
                    </Text>
                    <Text style={styles.optionSubtitle}>{vehicle.agency?.agencyName || "Agency Fleet"}</Text>
                    <Text style={styles.bodyTypeTag}>{vehicle.bodyType || "Open Body"}</Text>
                  </View>

                  <View style={[styles.radioCircle, isSelected && styles.radioActive]}>
                    {isSelected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {!loading ? (
        <Button
          title="Review & Confirm Booking"
          icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
          iconPosition="right"
          onPress={continueToConfirm}
          disabled={selectedId === "" && !selectedAgencyId}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotDone: {
    backgroundColor: colors.primary
  },
  stepDotActive: {
    backgroundColor: colors.primary
  },
  stepNumActive: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700"
  },
  stepLabelDone: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4
  },
  stepLabelActive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4
  },
  stepLineDone: {
    backgroundColor: colors.primary,
    flex: 1,
    height: 1,
    marginHorizontal: 8
  },
  list: {
    gap: 12
  },
  vehicleOptionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 16
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize"
  },
  bodyTypeTag: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textLight,
    alignItems: "center",
    justifyContent: "center"
  },
  radioActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  }
});
