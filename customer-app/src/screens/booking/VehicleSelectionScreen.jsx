import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, StyleSheet, Image, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import fareService from "../../services/fareService";
import { Button, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";
import { getCleanVehicleDisplayName, formatVehicleCategory } from "../../utils/vehicleDisplay";

const formatCategory = (category) => formatVehicleCategory(category);

const formatCapacity = (loadCapacity) => {
  if (!loadCapacity || loadCapacity.value == null) return "Standard Capacity";
  const unitStr = loadCapacity.unit === "ton" ? "Tons" : "kg";
  return `Capacity: ${loadCapacity.value} ${unitStr}`;
};

const getVehicleDisplayName = (vehicle) => getCleanVehicleDisplayName(vehicle);

/**
 * Determines whether a registration plate is valid to display separately.
 * Valid plates must have alphabetic characters and not be purely numeric or arbitrary digits.
 */
const getValidRegistrationPlate = (vehicleNumber) => {
  if (!vehicleNumber || typeof vehicleNumber !== "string") return null;
  const trimmed = vehicleNumber.trim();
  if (trimmed.length >= 5 && /[a-zA-Z]/.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
};

export default function VehicleSelectionScreen({ route, navigation }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(route.params?.vehicleId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fare Quotations State
  const [fareQuotes, setFareQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const isInstant = route.params?.bookingMode === "instant";

  const distanceKm = useMemo(() => {
    const raw = Number(route.params?.distanceKm);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [route.params?.distanceKm]);

  const weightObj = useMemo(() => {
    if (route.params?.weight?.value != null) {
      return {
        value: Number(route.params.weight.value),
        unit: route.params.weight.unit || "kg"
      };
    }
    return null;
  }, [route.params?.weight]);

  const requestedWeightKg = useMemo(() => {
    if (weightObj?.unit === "ton") {
      return (weightObj.value || 0) * 1000;
    }
    return weightObj?.value || 0;
  }, [weightObj]);

  // Load available vehicles matching category filter if provided
  useEffect(() => {
    vehicleService
      .getVehicles(route.params?.vehicleType ? { vehicleType: route.params.vehicleType } : {})
      .then(setVehicles)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [route.params?.vehicleType]);

  // Load authoritative backend fare quotations using actual ORS road distance
  useEffect(() => {
    if (!distanceKm || !weightObj || weightObj.value <= 0) {
      setFareQuotes({});
      return;
    }

    let isCurrent = true;
    setQuotesLoading(true);

    fareService
      .getQuotes({
        distanceKm,
        weight: weightObj
      })
      .then((data) => {
        if (!isCurrent) return;
        const quotesList = data?.quotes || [];
        const quoteMap = {};
        for (const q of quotesList) {
          quoteMap[q.vehicleType] = q.finalFare;
        }
        setFareQuotes(quoteMap);
      })
      .catch(() => {
        if (!isCurrent) return;
        setFareQuotes({});
      })
      .finally(() => {
        if (isCurrent) setQuotesLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [distanceKm, weightObj]);

  // Filter only active, available vehicles belonging to approved active agencies with sufficient capacity
  const cargoCompatibleVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const isApprovedAgency =
        vehicle.agency?._id &&
        vehicle.agency.approvalStatus === "approved" &&
        vehicle.agency.isActive;
      if (!isApprovedAgency) return false;

      const capacityKg =
        vehicle.loadCapacity?.unit === "ton"
          ? Number(vehicle.loadCapacity.value || 0) * 1000
          : Number(vehicle.loadCapacity?.value || 0);

      return capacityKg >= requestedWeightKg;
    });
  }, [vehicles, requestedWeightKg]);

  // Auto-select first compatible vehicle if none is selected
  useEffect(() => {
    if (!selectedId && cargoCompatibleVehicles.length > 0) {
      setSelectedId(cargoCompatibleVehicles[0]._id);
    }
  }, [cargoCompatibleVehicles, selectedId]);

  const continueToConfirm = () => {
    const selected = cargoCompatibleVehicles.find((vehicle) => vehicle._id === selectedId) || cargoCompatibleVehicles[0];
    if (!selected) {
      setError("Please select an eligible vehicle to continue.");
      return;
    }

    if (!distanceKm || distanceKm <= 0) {
      setError("Road distance is required to calculate fare. Please return to the Route screen to verify locations.");
      return;
    }

    const selectedAgencyId = selected.agency?._id || selected.agency || null;
    const estimatedFare = fareQuotes[selected.vehicleType] ?? null;
    const displayName = getVehicleDisplayName(selected);

    navigation.navigate("BookingConfirm", {
      ...route.params,
      distanceKm,
      vehicleType: selected.vehicleType || route.params?.vehicleType || "mini-truck",
      vehicleId: selected._id,
      agencyId: selectedAgencyId,
      vehicle: {
        ...selected,
        vehicleModel: displayName,
        displayName
      },
      estimatedFare
    });
  };

  return (
    <Screen>
      <Heading
        title="Select Vehicle"
        subtitle="Choose a verified commercial vehicle for your transport request."
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

      {/* TRIP METRICS BANNER */}
      {distanceKm ? (
        <View style={styles.metricsBanner}>
          <View style={styles.metricItem}>
            <Ionicons name="navigate-outline" size={15} color={colors.primary} />
            <Text style={styles.metricText}>Road Distance: <Text style={styles.metricBold}>{distanceKm} km</Text></Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="cube-outline" size={15} color={colors.primary} />
            <Text style={styles.metricText}>Cargo: <Text style={styles.metricBold}>{weightObj?.value} {weightObj?.unit}</Text></Text>
          </View>
        </View>
      ) : (
        <Notice
          type="error"
          message="Road distance is 0 or could not be determined. Please go back to the Route screen and re-select your pickup and drop locations."
        />
      )}

      {loading ? (
        <Loading label="Finding available vehicles..." />
      ) : (
        <View style={styles.list}>
          {cargoCompatibleVehicles.length === 0 ? (
            <View style={[styles.emptyCard, shadows.soft]}>
              <MaterialCommunityIcons name="truck-alert-outline" size={44} color={colors.textLight} />
              <Text style={styles.emptyTitle}>No Matching Vehicles Available</Text>
              <Text style={styles.emptySubtitle}>
                We could not find verified vehicles with sufficient capacity (
                {requestedWeightKg >= 1000
                  ? `${(requestedWeightKg / 1000).toFixed(1)} Tons`
                  : `${requestedWeightKg} kg`}
                ) currently ready for dispatch.
              </Text>
              <Text style={styles.emptyHint}>
                Please check your cargo weight or select another vehicle category.
              </Text>
            </View>
          ) : (
            cargoCompatibleVehicles.map((vehicle) => {
              const isSelected = selectedId === vehicle._id;
              const estimatedFare = fareQuotes[vehicle.vehicleType];
              const displayName = getVehicleDisplayName(vehicle);
              const validPlate = getValidRegistrationPlate(vehicle.vehicleNumber);

              return (
                <Pressable
                  key={vehicle._id}
                  style={[
                    styles.vehicleCard,
                    shadows.soft,
                    isSelected && styles.selectedVehicleCard
                  ]}
                  onPress={() => setSelectedId(vehicle._id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.cardHeader}>
                    {vehicle.vehicleImage ? (
                      <Image
                        source={{ uri: vehicle.vehicleImage }}
                        style={styles.vehicleThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="truck-fast-outline" size={28} color={colors.primary} />
                      </View>
                    )}

                    <View style={styles.metaContainer}>
                      <Text style={styles.vehicleModelText} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <View style={styles.categoryBadgeRow}>
                        <Text style={styles.categoryText}>
                          {formatCategory(vehicle.vehicleType)}
                        </Text>
                        {validPlate ? (
                          <Text style={styles.plateText}> · {validPlate}</Text>
                        ) : null}
                      </View>
                      <View style={styles.capacityRow}>
                        <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.capacityText}>
                          {formatCapacity(vehicle.loadCapacity)}
                        </Text>
                      </View>
                    </View>

                    {/* FARE & SELECTION CONTAINER */}
                    <View style={styles.fareSelectionCol}>
                      <View style={[styles.radioCircle, isSelected && styles.radioActive]}>
                        {isSelected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                      </View>

                      {quotesLoading ? (
                        <View style={styles.fareLoadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      ) : estimatedFare != null ? (
                        <View style={styles.fareContainer}>
                          <Text style={styles.fareAmountText}>₹{estimatedFare.toFixed(2)}</Text>
                          <Text style={styles.fareEstLabel}>Est. Total</Text>
                        </View>
                      ) : (
                        <View style={styles.fareUnavailableContainer}>
                          <Text style={styles.fareUnavailableText}>Fare unavailable</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.statusPill}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusPillText}>
                        {isInstant ? "Ready for Immediate Dispatch" : "Available for Schedule"}
                      </Text>
                    </View>

                    {isSelected ? (
                      <Text style={styles.selectedBadgeText}>Selected</Text>
                    ) : (
                      <Text style={styles.tapToSelectText}>Tap to select</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {!loading && cargoCompatibleVehicles.length > 0 ? (
        <Button
          title="Review & Confirm Booking"
          icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
          iconPosition="right"
          onPress={continueToConfirm}
          disabled={!selectedId || !distanceKm}
          style={{ marginTop: 16 }}
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
    marginBottom: 10
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
  metricsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.line
  },
  metricText: {
    color: colors.textMuted,
    fontSize: 12
  },
  metricBold: {
    color: colors.text,
    fontWeight: "700"
  },
  list: {
    gap: 12
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14
  },
  selectedVehicleCard: {
    borderColor: colors.primary,
    backgroundColor: "#F0F9FF"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  vehicleThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  metaContainer: {
    flex: 1
  },
  vehicleModelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  categoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2
  },
  categoryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  plateText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  capacityText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500"
  },
  fareSelectionCol: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 56
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
  },
  fareLoadingContainer: {
    paddingTop: 6
  },
  fareContainer: {
    alignItems: "flex-end",
    marginTop: 4
  },
  fareAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark || "#0071AB"
  },
  fareEstLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
    marginTop: 1
  },
  fareUnavailableContainer: {
    alignItems: "flex-end",
    marginTop: 4
  },
  fareUnavailableText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic"
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A"
  },
  statusPillText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "600"
  },
  selectedBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  tapToSelectText: {
    color: colors.textLight,
    fontSize: 12
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    alignItems: "center",
    textAlign: "center"
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  },
  emptyHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10
  }
});
