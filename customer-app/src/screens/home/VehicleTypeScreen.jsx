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
import EVBadge from "../../components/EVBadge";

const ALL_VEHICLE_TYPES = [
  // EV Passenger Category
  {
    type: "electric-rickshaw",
    title: "Electric Rickshaw",
    category: SERVICE_CATEGORIES.EV_PASSENGER,
    icon: "lightning-bolt-outline",
    desc: "Eco-friendly electric rickshaw for quick and affordable passenger travel.",
    idealFor: "Up to 3-4 Passengers · Zero Emissions"
  },
  {
    type: "electric-passenger-three-wheeler",
    title: "Electric Passenger Three-Wheeler",
    category: SERVICE_CATEGORIES.EV_PASSENGER,
    icon: "lightning-bolt-outline",
    desc: "Spacious electric passenger three-wheeler for daily urban commutes.",
    idealFor: "Up to 4 Passengers · Green Travel"
  },
  {
    type: "other-electric-passenger",
    title: "Other Electric Passenger Vehicle",
    category: SERVICE_CATEGORIES.EV_PASSENGER,
    icon: "lightning-bolt-outline",
    desc: "Modern electric passenger vehicle providing a clean and comfortable ride.",
    idealFor: "Up to 4-6 Passengers · Electric"
  },

  // Taxi Category
  {
    type: "sedan",
    title: "Sedan Taxi",
    category: SERVICE_CATEGORIES.TAXI,
    icon: "car-outline",
    desc: "Comfortable air-conditioned sedan taxi for comfortable point-to-point travel.",
    idealFor: "Up to 4 Passengers · AC Comfort"
  },
  {
    type: "hatchback",
    title: "Hatchback Taxi",
    category: SERVICE_CATEGORIES.TAXI,
    icon: "car-outline",
    desc: "Affordable compact city taxi for quick, economical passenger travel.",
    idealFor: "Up to 4 Passengers · Compact & Fast"
  },
  {
    type: "suv",
    title: "SUV Taxi",
    category: SERVICE_CATEGORIES.TAXI,
    icon: "car-estate",
    desc: "Spacious premium SUV taxi for group passenger travel and outstation trips.",
    idealFor: "Up to 6-7 Passengers · Extra Legroom"
  },

  // Goods Transport Category
  {
    type: "pickup",
    title: "Pickup",
    category: SERVICE_CATEGORIES.GOODS_TRANSPORT,
    icon: "truck-outline",
    desc: "For quick, light deliveries, furniture, and intra-city cargo logistics.",
    idealFor: "Up to 1250 - 1750 kg"
  },
  {
    type: "mini-truck",
    title: "Mini Truck",
    category: SERVICE_CATEGORIES.GOODS_TRANSPORT,
    icon: "truck-fast-outline",
    desc: "Ideal for small to medium goods, local moves, and commercial freight.",
    idealFor: "Up to 750 - 1200 kg"
  },
  {
    type: "small-truck",
    title: "Small Truck",
    category: SERVICE_CATEGORIES.GOODS_TRANSPORT,
    icon: "truck-cargo-container",
    desc: "For intra-city commercial loads and distribution batches.",
    idealFor: "Up to 1.5 - 2.5 tons"
  },
  {
    type: "medium-truck",
    title: "Medium Truck",
    category: SERVICE_CATEGORIES.GOODS_TRANSPORT,
    icon: "truck-flatbed",
    desc: "For regional logistics, large consignments, and bulk freight transport.",
    idealFor: "Up to 2.5 - 4.5 tons"
  },
  {
    type: "large-truck",
    title: "Large Truck",
    category: SERVICE_CATEGORIES.GOODS_TRANSPORT,
    icon: "truck-trailer",
    desc: "For heavy industrial freight, long-haul logistics, and container loads.",
    idealFor: "Up to 5 - 10+ tons"
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

  const isEvEnabled = (config["service.ev_passenger.enabled"] ?? config["service.ev_goods.enabled"]) !== false;
  const isTaxiEnabled = (config["service.taxi.enabled"] ?? config["service.goods_taxi.enabled"]) !== false;

  // Filter categories according to Admin settings
  const availableTabs = useMemo(() => {
    const tabs = [
      { key: "all", label: "All Services" }
    ];
    if (isEvEnabled) {
      tabs.push({ key: SERVICE_CATEGORIES.EV_PASSENGER, label: "EV Passenger" });
    }
    if (isTaxiEnabled) {
      tabs.push({ key: SERVICE_CATEGORIES.TAXI, label: "Taxi" });
    }
    tabs.push({ key: SERVICE_CATEGORIES.GOODS_TRANSPORT, label: "Goods Transport" });
    return tabs;
  }, [isEvEnabled, isTaxiEnabled]);

  // Filter vehicle items based on Admin settings and tab selection
  const filteredVehicleTypes = useMemo(() => {
    return ALL_VEHICLE_TYPES.filter((item) => {
      if ((item.category === SERVICE_CATEGORIES.EV_PASSENGER || item.category === SERVICE_CATEGORIES.EV_GOODS) && !isEvEnabled) return false;
      if ((item.category === SERVICE_CATEGORIES.TAXI || item.category === SERVICE_CATEGORIES.GOODS_TAXI) && !isTaxiEnabled) return false;
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
            const isEV = item.category === SERVICE_CATEGORIES.EV_PASSENGER || item.category === SERVICE_CATEGORIES.EV_GOODS;
            const isTaxi = item.category === SERVICE_CATEGORIES.TAXI || item.category === SERVICE_CATEGORIES.GOODS_TAXI;

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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {isEV ? <EVBadge vehicle={{ serviceCategory: item.category }} size="small" /> : null}
                      </View>
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
