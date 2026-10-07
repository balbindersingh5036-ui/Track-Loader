import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  ScrollView,
  StyleSheet
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import {
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Loading,
  Notice,
  Screen
} from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

const types = [
  { key: "all", label: "All" },
  { key: "mini-truck", label: "Mini Truck" },
  { key: "pickup", label: "Pickup" },
  { key: "small-truck", label: "Small Truck" },
  { key: "medium-truck", label: "Medium Truck" },
  { key: "large-truck", label: "Large Truck" }
];

export default function VehicleListScreen({ navigation, route }) {
  const [vehicleType, setVehicleType] = useState(route.params?.vehicleType || "all");
  const [minCapacity, setMinCapacity] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (capacityFilters = {}) => {
      setError("");
      try {
        const filters = {};
        if (vehicleType !== "all") filters.vehicleType = vehicleType;
        if (capacityFilters.minCapacity?.trim()) {
          filters.minCapacity = capacityFilters.minCapacity.trim();
        }
        if (capacityFilters.maxCapacity?.trim()) {
          filters.maxCapacity = capacityFilters.maxCapacity.trim();
        }

        const result =
          vehicleType !== "all" &&
          !capacityFilters.minCapacity?.trim() &&
          !capacityFilters.maxCapacity?.trim()
            ? await vehicleService.getVehiclesByType(vehicleType)
            : await vehicleService.getVehicles(filters);

        setVehicles(result || []);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [vehicleType]
  );

  useEffect(() => {
    setVehicleType(route.params?.vehicleType || "all");
  }, [route.params?.vehicleType]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleApplyFilter = () => {
    setLoading(true);
    load({ minCapacity, maxCapacity });
    setShowFilterPanel(false);
  };

  const handleClearFilter = () => {
    setMinCapacity("");
    setMaxCapacity("");
    setLoading(true);
    load({});
    setShowFilterPanel(false);
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load({ minCapacity, maxCapacity });
      }}
    >
      <Heading
        title="Available Vehicles"
        subtitle="Browse verified vehicles available for booking."
        right={
          <Pressable
            style={styles.filterToggleBtn}
            onPress={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Ionicons
              name={showFilterPanel ? "options" : "options-outline"}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.filterToggleText}>Filter</Text>
          </Pressable>
        }
      />

      {/* CATEGORY FILTER CHIPS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContainer}
      >
        {types.map((t) => {
          const active = vehicleType === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setVehicleType(t.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* COLLAPSIBLE CAPACITY FILTER PANEL */}
      {showFilterPanel ? (
        <View style={[styles.filterPanel, shadows.soft]}>
          <Text style={styles.filterPanelTitle}>Filter by Load Capacity</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field
              style={{ flex: 1 }}
              label="Min Capacity (kg)"
              value={minCapacity}
              onChangeText={setMinCapacity}
              keyboardType="decimal-pad"
              placeholder="e.g. 500"
            />
            <Field
              style={{ flex: 1 }}
              label="Max Capacity (kg)"
              value={maxCapacity}
              onChangeText={setMaxCapacity}
              keyboardType="decimal-pad"
              placeholder="e.g. 5000"
            />
          </View>
          <View style={styles.filterActionRow}>
            <Button
              title="Clear"
              secondary
              onPress={handleClearFilter}
              style={{ flex: 1, minHeight: 40 }}
            />
            <Button
              title="Apply"
              onPress={handleApplyFilter}
              style={{ flex: 1, minHeight: 40 }}
            />
          </View>
        </View>
      ) : null}

      {error ? <Notice message={error} /> : null}

      {loading ? (
        <Loading label="Fetching available vehicles..." />
      ) : vehicles.length === 0 ? (
        <Empty
          title="No vehicles found"
          detail="Try selecting a different category or clearing capacity filters."
          actionTitle="Reset filters"
          onAction={handleClearFilter}
        />
      ) : (
        <View style={styles.list}>
          {vehicles.map((vehicle) => (
            <Pressable
              key={vehicle._id}
              style={[styles.vehicleCard, shadows.soft]}
              onPress={() =>
                navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })
              }
            >
              {vehicle.vehicleImage ? (
                <Image
                  source={{ uri: vehicle.vehicleImage }}
                  style={styles.cardImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cardImgPlaceholder}>
                  <MaterialCommunityIcons
                    name="truck-outline"
                    size={36}
                    color={colors.textLight}
                  />
                </View>
              )}

              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modelName} numberOfLines={1}>
                      {vehicle.vehicleModel}
                    </Text>
                    <Text style={styles.typeLabel}>
                      {vehicle.vehicleType?.replace(/-/g, " ")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      vehicle.isAvailable ? styles.statusAvail : styles.statusBusy
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        vehicle.isAvailable ? styles.statusTextAvail : styles.statusTextBusy
                      ]}
                    >
                      {vehicle.isAvailable ? "Available" : "Assigned"}
                    </Text>
                  </View>
                </View>

                <View style={styles.specsGrid}>
                  <View style={styles.specBadge}>
                    <Ionicons name="speedometer-outline" size={13} color={colors.primary} />
                    <Text style={styles.specVal}>
                      {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}
                    </Text>
                  </View>

                  <View style={styles.specBadge}>
                    <Ionicons name="cube-outline" size={13} color={colors.primary} />
                    <Text style={styles.specVal}>
                      {vehicle.bodyType || "Open Body"}
                    </Text>
                  </View>

                  {vehicle.vehicleNumber ? (
                    <View style={styles.specBadge}>
                      <Ionicons name="card-outline" size={13} color={colors.primary} />
                      <Text style={styles.specVal}>{vehicle.vehicleNumber}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.detailsLink}>View Specs & Pricing</Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  filterToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  chipContainer: {
    gap: 8,
    paddingVertical: 2
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: "700"
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    gap: 12
  },
  filterPanelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  filterActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  list: {
    gap: 14
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden"
  },
  cardImg: {
    width: "100%",
    height: 150,
    backgroundColor: colors.surfaceAlt
  },
  cardImgPlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  cardContent: {
    padding: 14,
    gap: 10
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  modelName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  typeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize",
    marginTop: 1
  },
  statusPill: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  statusAvail: {
    backgroundColor: colors.successBg
  },
  statusBusy: {
    backgroundColor: colors.warningBg
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800"
  },
  statusTextAvail: {
    color: colors.successText
  },
  statusTextBusy: {
    color: colors.warningText
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  specBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  specVal: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: "500"
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10
  },
  detailsLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
