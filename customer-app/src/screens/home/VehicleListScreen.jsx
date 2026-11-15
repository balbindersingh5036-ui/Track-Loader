import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import configService from "../../services/configService";
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
import { getOptimizedImageUrl } from "../../utils/imageOptimizer";
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  VEHICLE_TYPES_BY_CATEGORY,
  formatVehicleCategory
} from "../../utils/vehicleDisplay";

export default function VehicleListScreen({ navigation, route }) {
  const [serviceCategory, setServiceCategory] = useState(
    route.params?.serviceCategory || "all"
  );
  const [vehicleType, setVehicleType] = useState(route.params?.vehicleType || "all");
  const [minCapacity, setMinCapacity] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isEvEnabled = config["service.ev_goods.enabled"] !== false;
  const isTaxiEnabled = config["service.goods_taxi.enabled"] !== false;

  useEffect(() => {
    configService.getPublicConfig()
      .then((cfg) => setConfig(cfg || {}))
      .catch(() => {});
  }, []);

  const categoryTabs = useMemo(() => {
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

  const subcategoryChips = useMemo(() => {
    const chips = [{ key: "all", label: "All Types" }];
    let allowedTypes = [];
    if (serviceCategory === "all") {
      allowedTypes = [
        ...VEHICLE_TYPES_BY_CATEGORY.TRUCK,
        ...(isEvEnabled ? VEHICLE_TYPES_BY_CATEGORY.EV_GOODS : []),
        ...(isTaxiEnabled ? VEHICLE_TYPES_BY_CATEGORY.GOODS_TAXI : [])
      ];
    } else if (VEHICLE_TYPES_BY_CATEGORY[serviceCategory]) {
      allowedTypes = VEHICLE_TYPES_BY_CATEGORY[serviceCategory];
    }
    for (const t of allowedTypes) {
      chips.push({ key: t, label: formatVehicleCategory(t) });
    }
    return chips;
  }, [serviceCategory, isEvEnabled, isTaxiEnabled]);

  const load = useCallback(
    async (capacityFilters = {}) => {
      setError("");
      try {
        const filters = {};
        if (serviceCategory !== "all") {
          filters.serviceCategory = serviceCategory;
        }
        if (vehicleType !== "all") {
          filters.vehicleType = vehicleType;
        }
        if (capacityFilters.minCapacity?.trim()) {
          filters.minCapacity = capacityFilters.minCapacity.trim();
        }
        if (capacityFilters.maxCapacity?.trim()) {
          filters.maxCapacity = capacityFilters.maxCapacity.trim();
        }

        const result = await vehicleService.getVehicles(filters);
        setVehicles(result || []);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serviceCategory, vehicleType]
  );

  useEffect(() => {
    if (route.params?.serviceCategory) {
      setServiceCategory(route.params.serviceCategory);
    }
    if (route.params?.vehicleType) {
      setVehicleType(route.params.vehicleType);
    }
  }, [route.params?.serviceCategory, route.params?.vehicleType]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleCategoryChange = (newCat) => {
    setServiceCategory(newCat);
    setVehicleType("all");
    setLoading(true);
  };

  const handleApplyFilter = () => {
    setLoading(true);
    load({ minCapacity, maxCapacity });
    setShowFilterPanel(false);
  };

  const handleClearFilter = () => {
    setMinCapacity("");
    setMaxCapacity("");
    setVehicleType("all");
    setServiceCategory("all");
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
        subtitle="Browse verified commercial vehicles ready for dispatch."
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

      {/* PRIMARY CATEGORY TABS */}
      <View style={styles.categoryTabRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categoryTabs.map((tab) => {
            const active = serviceCategory === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleCategoryChange(tab.key)}
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

      {/* SUBCATEGORY FILTER CHIPS */}
      {subcategoryChips.length > 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContainer}
        >
          {subcategoryChips.map((t) => {
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
      ) : null}

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
          detail="Try selecting a different service category or clearing capacity filters."
          actionTitle="Reset filters"
          onAction={handleClearFilter}
        />
      ) : (
        <View style={styles.list}>
          {vehicles.map((vehicle) => {
            const isEV = vehicle.serviceCategory === SERVICE_CATEGORIES.EV_GOODS;
            const isTaxi = vehicle.serviceCategory === SERVICE_CATEGORIES.GOODS_TAXI;

            return (
              <Pressable
                key={vehicle._id}
                style={[styles.vehicleCard, shadows.soft]}
                onPress={() =>
                  navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })
                }
              >
                {vehicle.vehicleImage ? (
                  <Image
                    source={{ uri: getOptimizedImageUrl(vehicle.vehicleImage, { width: 600 }) }}
                    style={styles.cardImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.cardImgPlaceholder,
                      isEV && styles.cardImgPlaceholderEV,
                      isTaxi && styles.cardImgPlaceholderTaxi
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isEV ? "lightning-bolt-outline" : isTaxi ? "truck-delivery-outline" : "truck-outline"}
                      size={36}
                      color={isEV ? "#10B981" : isTaxi ? "#F59E0B" : colors.textLight}
                    />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelName} numberOfLines={1}>
                        {vehicle.vehicleModel}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
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
                            {SERVICE_CATEGORY_LABELS[vehicle.serviceCategory] || "Truck"}
                          </Text>
                        </View>
                        <Text style={styles.typeLabel}>
                          {formatVehicleCategory(vehicle.vehicleType)}
                        </Text>
                      </View>
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
                        {vehicle.bodyType || (isEV ? "EV Loader" : "Open Body")}
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
            );
          })}
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
  categoryTabRow: {
    marginBottom: 10
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
  chipContainer: {
    gap: 8,
    paddingBottom: 12
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
    gap: 10
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
    height: 160,
    backgroundColor: colors.surfaceAlt
  },
  cardImgPlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  cardImgPlaceholderEV: {
    backgroundColor: "rgba(16, 185, 129, 0.08)"
  },
  cardImgPlaceholderTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.08)"
  },
  cardContent: {
    padding: 14,
    gap: 10
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  modelName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  typeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
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
    fontSize: 11,
    fontWeight: "700"
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
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  specVal: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10,
    marginTop: 2
  },
  detailsLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
