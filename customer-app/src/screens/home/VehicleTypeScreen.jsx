import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, StyleSheet, ScrollView } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import configService from "../../services/configService";
import { Card, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS
} from "../../utils/vehicleDisplay";

const ALL_VEHICLE_TYPES = [
  // Trucks Category
  {
    type: "mini-truck",
    title: "Mini Truck",
    category: SERVICE_CATEGORIES.TRUCK,
    icon: "truck-fast-outline",
    desc: "Ideal for small to medium goods, local moves, and light cargo.",
    idealFor: "Up to 750 - 1200 kg"
  },
  {
    type: "pickup",
    title: "Pickup",
    category: SERVICE_CATEGORIES.TRUCK,
    icon: "truck-outline",
    desc: "For quick, light deliveries, furniture, and intra-city hardware.",
    idealFor: "Up to 1250 - 1750 kg"
  },
  {
    type: "small-truck",
    title: "Small Truck",
    category: SERVICE_CATEGORIES.TRUCK,
    icon: "truck-cargo-container",
    desc: "For intra-city commercial loads and distribution batches.",
    idealFor: "Up to 1.5 - 2.5 tons"
  },
  {
    type: "medium-truck",
    title: "Medium Truck",
    category: SERVICE_CATEGORIES.TRUCK,
    icon: "truck-flatbed",
    desc: "For regional logistics, large consignments, and bulk transport.",
    idealFor: "Up to 2.5 - 4.5 tons"
  },
  {
    type: "large-truck",
    title: "Large Truck",
    category: SERVICE_CATEGORIES.TRUCK,
    icon: "truck-trailer",
    desc: "For heavy industrial freight, long-haul logistics, and containers.",
    idealFor: "Up to 5 - 10+ tons"
  },

  // EV Goods Category
  {
    type: "electric-cargo-loader",
    title: "Electric Cargo Loader",
    category: SERVICE_CATEGORIES.EV_GOODS,
    icon: "lightning-bolt-outline",
    desc: "Zero emission 3-wheeler/4-wheeler cargo loader for green deliveries.",
    idealFor: "Up to 500 - 800 kg · Zero Emissions"
  },
  {
    type: "electric-goods-e-rickshaw",
    title: "Electric Goods E-Rickshaw",
    category: SERVICE_CATEGORIES.EV_GOODS,
    icon: "lightning-bolt-outline",
    desc: "Compact electric carrier built for narrow urban streets and market distribution.",
    idealFor: "Up to 400 - 600 kg · Electric Urban"
  },
  {
    type: "electric-mini-cargo-carrier",
    title: "Electric Mini Cargo Carrier",
    category: SERVICE_CATEGORIES.EV_GOODS,
    icon: "lightning-bolt-outline",
    desc: "High efficiency electric mini carrier for commercial parcel logistics.",
    idealFor: "Up to 800 - 1200 kg · Battery Powered"
  },
  {
    type: "other-electric-goods",
    title: "Electric Goods Carrier",
    category: SERVICE_CATEGORIES.EV_GOODS,
    icon: "lightning-bolt-outline",
    desc: "Specialized electric freight vehicle tailored for eco-friendly shipping.",
    idealFor: "Custom EV Capacity · Green Logistics"
  },

  // Goods Taxi Category
  {
    type: "mini-pickup",
    title: "Mini Pickup Taxi",
    category: SERVICE_CATEGORIES.GOODS_TAXI,
    icon: "truck-delivery-outline",
    desc: "Fast on-demand goods taxi for small furniture, luggage, and urgent goods.",
    idealFor: "Up to 600 - 900 kg · Rapid Dispatch"
  },
  {
    type: "tata-ace",
    title: "Tata Ace / Chota Hathi",
    category: SERVICE_CATEGORIES.GOODS_TAXI,
    icon: "truck-outline",
    desc: "India's trusted compact goods carrier for intra-city trade and market loads.",
    idealFor: "Up to 750 - 1000 kg · Market Champion"
  },
  {
    type: "cargo-pickup",
    title: "Cargo Pickup Taxi",
    category: SERVICE_CATEGORIES.GOODS_TAXI,
    icon: "truck-fast-outline",
    desc: "Dedicated cargo taxi vehicle for swift retail deliveries and wholesale dispatch.",
    idealFor: "Up to 1.0 - 1.5 tons · High Speed"
  },
  {
    type: "goods-loading-taxi",
    title: "Goods Loading Taxi",
    category: SERVICE_CATEGORIES.GOODS_TAXI,
    icon: "package-variant-closed",
    desc: "Instant loading and unloading service for commercial cartons and equipment.",
    idealFor: "Up to 500 - 800 kg · Loading Assisted"
  },
  {
    type: "other-goods-carrier",
    title: "Goods Carrier Taxi",
    category: SERVICE_CATEGORIES.GOODS_TAXI,
    icon: "truck-outline",
    desc: "General goods taxi carrier ready for quick city-wide dispatch.",
    idealFor: "Up to 1 ton · City-Wide"
  }
];

export default function VehicleTypeScreen({ navigation, route }) {
  const selected = route.params?.vehicleType;
  const initialCategory = route.params?.serviceCategory || "all";
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [vehicles, setVehicles] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      vehicleService.getVehicles(),
      configService.getPublicConfig().catch(() => ({}))
    ])
      .then(([vehicleList, publicConfig]) => {
        setVehicles(vehicleList || []);
        setConfig(publicConfig || {});
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const isEvEnabled = config["service.ev_goods.enabled"] !== false;
  const isTaxiEnabled = config["service.goods_taxi.enabled"] !== false;

  // Filter categories according to Admin settings
  const availableTabs = useMemo(() => {
    const tabs = [
      { key: "all", label: "All Services" },
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

  // Filter vehicle items based on Admin settings and tab selection
  const filteredVehicleTypes = useMemo(() => {
    return ALL_VEHICLE_TYPES.filter((item) => {
      if (item.category === SERVICE_CATEGORIES.EV_GOODS && !isEvEnabled) return false;
      if (item.category === SERVICE_CATEGORIES.GOODS_TAXI && !isTaxiEnabled) return false;
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      return true;
    });
  }, [selectedCategory, isEvEnabled, isTaxiEnabled]);

  return (
    <Screen>
      <Heading
        title="Vehicle Categories"
        subtitle="Select a category to view available transport vehicles and capacity."
      />

      {error ? <Notice message={error} /> : null}

      {/* CATEGORY SELECTOR TABS */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {availableTabs.map((tab) => {
            const isActive = selectedCategory === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setSelectedCategory(tab.key)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <Loading label="Loading vehicle categories..." />
      ) : (
        <View style={styles.list}>
          {filteredVehicleTypes.map((item) => {
            const count = vehicles.filter(
              (v) => v.vehicleType === item.type && v.isAvailable
            ).length;
            const isSelected = selected === item.type;
            const isEV = item.category === SERVICE_CATEGORIES.EV_GOODS;
            const isTaxi = item.category === SERVICE_CATEGORIES.GOODS_TAXI;

            return (
              <Pressable
                key={item.type}
                style={[
                  styles.categoryCard,
                  shadows.soft,
                  isSelected && styles.categoryCardSelected
                ]}
                onPress={() =>
                  navigation.navigate("VehicleList", {
                    vehicleType: item.type,
                    serviceCategory: item.category
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconBox,
                      isEV && styles.iconBoxEV,
                      isTaxi && styles.iconBoxTaxi
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={28}
                      color={isEV ? "#10B981" : isTaxi ? "#F59E0B" : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <View style={styles.availPill}>
                        <Text style={styles.availText}>
                          {count} available
                        </Text>
                      </View>
                    </View>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.categoryPill,
                          isEV && styles.categoryPillEV,
                          isTaxi && styles.categoryPillTaxi
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            isEV && styles.categoryPillTextEV,
                            isTaxi && styles.categoryPillTextTaxi
                          ]}
                        >
                          {SERVICE_CATEGORY_LABELS[item.category] || item.category}
                        </Text>
                      </View>
                      <Text style={styles.idealText}>{item.idealFor}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.descText}>{item.desc}</Text>

                <View style={styles.cardBottom}>
                  <Text style={styles.browseText}>Browse {item.title}s</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
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
  tabContainer: {
    marginBottom: 14
  },
  tabScroll: {
    gap: 8,
    paddingVertical: 2
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted
  },
  tabTextActive: {
    color: "#FFFFFF"
  },
  list: {
    gap: 12
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  iconBoxEV: {
    backgroundColor: "rgba(16, 185, 129, 0.12)"
  },
  iconBoxTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.12)"
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    flexWrap: "wrap"
  },
  categoryPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  categoryPillEV: {
    backgroundColor: "rgba(16, 185, 129, 0.15)"
  },
  categoryPillTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.15)"
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted
  },
  categoryPillTextEV: {
    color: "#059669"
  },
  categoryPillTextTaxi: {
    color: "#D97706"
  },
  idealText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500"
  },
  descText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  availPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7
  },
  availText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700"
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10,
    marginTop: 2
  },
  browseText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
