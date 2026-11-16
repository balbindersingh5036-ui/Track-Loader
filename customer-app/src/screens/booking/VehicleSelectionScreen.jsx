import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, StyleSheet, Image, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import fareService from "../../services/fareService";
import configService from "../../services/configService";
import { Button, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";
import {
  getCleanVehicleDisplayName,
  formatVehicleCategory,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  isEVVehicle,
  getVehicleCategoryLabel
} from "../../utils/vehicleDisplay";
import EVBadge from "../../components/EVBadge";

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
  const [config, setConfig] = useState({});
  const initialCategory = route.params?.serviceCategory || "all";
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fare Quotations State
  const [fareQuotes, setFareQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const isInstant = route.params?.bookingMode === "instant";
  const serviceCategory = route.params?.serviceCategory;
  const loadingRequired = route.params?.loadingRequired === true;
  const unloadingRequired = route.params?.unloadingRequired === true;

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

  // Load public config
  useEffect(() => {
    configService.getPublicConfig()
      .then((cfg) => setConfig(cfg || {}))
      .catch(() => {});
  }, []);

  const isEvEnabled = config["service.ev_goods.enabled"] !== false;
  const isTaxiEnabled = config["service.goods_taxi.enabled"] !== false;

  const availableCategoryTabs = useMemo(() => {
    const tabs = [
      { key: "all", label: "All Vehicles" },
      { key: SERVICE_CATEGORIES.TRUCK, label: "Trucks" }
    ];
    if (isEvEnabled) {
      tabs.push({ key: SERVICE_CATEGORIES.EV_GOODS, label: "EV Goods" });
    }
    if (isTaxiEnabled) {
      tabs.push({ key: SERVICE_CATEGORIES.GOODS_TAXI, label: "Goods Taxi" });
    }
    return tabs;
  }, [isEvEnabled, isTaxiEnabled]);

  // Load available vehicles matching filters
  useEffect(() => {
    const queryParams = {
      ...(route.params?.vehicleType ? { vehicleType: route.params.vehicleType } : {}),
      ...(serviceCategory ? { serviceCategory } : {}),
      ...(route.params?.pickup?.address ? { pickupAddress: route.params.pickup.address } : {}),
      ...(route.params?.drop?.address ? { dropAddress: route.params.drop.address } : {})
    };

    vehicleService
      .getVehicles(queryParams)
      .then(setVehicles)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [route.params?.vehicleType, serviceCategory]);

  // Load authoritative backend fare quotations using actual ORS road distance
  useEffect(() => {
    if (!distanceKm || !weightObj || weightObj.value <= 0) {
      setFareQuotes({});
      return;
    }

    let isCurrent = true;
    setQuotesLoading(true);

    const quoteCategory = categoryFilter !== "all" ? categoryFilter : serviceCategory;

    fareService
      .getQuotes({
        distanceKm,
        weight: weightObj,
        serviceCategory: quoteCategory,
        loadingRequired,
        unloadingRequired
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
  }, [distanceKm, weightObj, categoryFilter, serviceCategory, loadingRequired, unloadingRequired]);

  // Filter only active, available vehicles belonging to approved active agencies with sufficient capacity
  const cargoCompatibleVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const isApprovedAgency =
        vehicle.agency?._id &&
        vehicle.agency.approvalStatus === "approved" &&
        vehicle.agency.isActive;
      if (!isApprovedAgency) return false;

      // Filter by Category selector tab
      if (categoryFilter !== "all") {
        const vCat = vehicle.serviceCategory || SERVICE_CATEGORIES.TRUCK;
        if (vCat !== categoryFilter) return false;
      }

      const capacityKg =
        vehicle.loadCapacity?.unit === "ton"
          ? Number(vehicle.loadCapacity.value || 0) * 1000
          : Number(vehicle.loadCapacity?.value || 0);

      return capacityKg >= requestedWeightKg;
    });
  }, [vehicles, requestedWeightKg, categoryFilter]);

  // Auto-select first compatible vehicle if none is selected or current selection is filtered out
  useEffect(() => {
    const isSelectedInList = cargoCompatibleVehicles.some((v) => v._id === selectedId);
    if (!isSelectedInList && cargoCompatibleVehicles.length > 0) {
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
    if (estimatedFare == null) {
      setError("Fare is not configured for this vehicle type. Please choose another available option.");
      return;
    }
    const displayName = getVehicleDisplayName(selected);
    const resolvedCategory = selected.serviceCategory || (categoryFilter !== "all" ? categoryFilter : serviceCategory || SERVICE_CATEGORIES.TRUCK);

    navigation.navigate("BookingConfirm", {
      ...route.params,
      distanceKm,
      vehicleType: selected.vehicleType || route.params?.vehicleType || "mini-truck",
      serviceCategory: resolvedCategory,
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

      {/* CATEGORY SELECTOR TABS */}
      <View style={styles.categoryTabRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {availableCategoryTabs.map((tab) => {
            const active = categoryFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setCategoryFilter(tab.key)}
                style={[styles.categoryTab, active && styles.categoryTabActive]}
              >
                <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
                ) currently ready for dispatch in this category.
              </Text>
              <Text style={styles.emptyHint}>
                Please switch to &quot;All Vehicles&quot; or adjust cargo weight.
              </Text>
            </View>
          ) : (
            cargoCompatibleVehicles.map((vehicle) => {
              const isSelected = selectedId === vehicle._id;
              const estimatedFare = fareQuotes[vehicle.vehicleType];
              const displayName = getVehicleDisplayName(vehicle);
              const validPlate = getValidRegistrationPlate(vehicle.vehicleNumber);
              const isEV = isEVVehicle(vehicle);
              const isTaxi = vehicle.serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI;

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
                    <View style={styles.thumbWrapper}>
                      {vehicle.vehicleImage ? (
                        <Image
                          source={{ uri: vehicle.vehicleImage }}
                          style={styles.vehicleThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.iconContainer,
                            isEV && styles.iconContainerEV,
                            isTaxi && styles.iconContainerTaxi
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isEV ? "lightning-bolt-outline" : isTaxi ? "truck-delivery-outline" : "truck-fast-outline"}
                            size={28}
                            color={isEV ? "#10B981" : isTaxi ? "#F59E0B" : colors.primary}
                          />
                        </View>
                      )}
                      <EVBadge vehicle={vehicle} size="small" style={styles.thumbEvOverlay} />
                    </View>

                    <View style={styles.metaContainer}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.vehicleModelText} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <EVBadge vehicle={vehicle} size="small" />
                      </View>
                      <View style={styles.categoryBadgeRow}>
                        <View
                          style={[
                            styles.catBadge,
                            isEV && styles.catBadgeEV,
                            isTaxi && styles.catBadgeTaxi
                          ]}
                        >
                          <Text
                            style={[
                              styles.catBadgeText,
                              isEV && styles.catBadgeTextEV,
                              isTaxi && styles.catBadgeTextTaxi
                            ]}
                          >
                            {getVehicleCategoryLabel(vehicle)}
                          </Text>
                        </View>
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
          onPress={continueToConfirm}
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
    justifyContent: "center",
    gap: 8,
    marginBottom: 16
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.textLight
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  stepDotDone: {
    borderColor: colors.primaryDark || "#0071AB",
    backgroundColor: colors.primaryDark || "#0071AB"
  },
  stepNumActive: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700"
  },
  stepLabelActive: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  stepLabelDone: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: colors.line
  },
  stepLineDone: {
    backgroundColor: colors.primaryDark || "#0071AB"
  },
  metricsBanner: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "space-around"
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.line
  },
  metricText: {
    color: colors.textMuted,
    fontSize: 13
  },
  metricBold: {
    color: colors.text,
    fontWeight: "700"
  },
  categoryTabRow: {
    marginBottom: 12
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted
  },
  categoryTabTextActive: {
    color: "#FFFFFF"
  },
  list: {
    gap: 12
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 2
  },
  selectedVehicleCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  thumbWrapper: {
    position: "relative",
    width: 60,
    height: 60
  },
  thumbEvOverlay: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 2
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
  iconContainerEV: {
    backgroundColor: "rgba(16, 185, 129, 0.12)"
  },
  iconContainerTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.12)"
  },
  metaContainer: {
    flex: 1
  },
  vehicleModelText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  categoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap"
  },
  catBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  catBadgeEV: {
    backgroundColor: "rgba(16, 185, 129, 0.15)"
  },
  catBadgeTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.15)"
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted
  },
  catBadgeTextEV: {
    color: "#059669"
  },
  catBadgeTextTaxi: {
    color: "#D97706"
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  plateText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700"
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
