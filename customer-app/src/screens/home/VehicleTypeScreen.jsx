import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import { Card, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

const VEHICLE_TYPES = [
  {
    type: "mini-truck",
    title: "Mini Truck",
    icon: "truck-fast-outline",
    desc: "Ideal for small to medium goods, local moves, and light cargo.",
    idealFor: "Up to 750 - 1200 kg"
  },
  {
    type: "pickup",
    title: "Pickup",
    icon: "truck-outline",
    desc: "For quick, light deliveries, furniture, and intra-city hardware.",
    idealFor: "Up to 1250 - 1750 kg"
  },
  {
    type: "small-truck",
    title: "Small Truck",
    icon: "truck-cargo-container",
    desc: "For intra-city commercial loads and distribution batches.",
    idealFor: "Up to 1.5 - 2.5 tons"
  },
  {
    type: "medium-truck",
    title: "Medium Truck",
    icon: "truck-flatbed",
    desc: "For regional logistics, large consignments, and bulk transport.",
    idealFor: "Up to 2.5 - 4.5 tons"
  },
  {
    type: "large-truck",
    title: "Large Truck",
    icon: "truck-trailer",
    desc: "For heavy industrial freight, long-haul logistics, and containers.",
    idealFor: "Up to 5 - 10+ tons"
  }
];

export default function VehicleTypeScreen({ navigation, route }) {
  const selected = route.params?.vehicleType;
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vehicleService
      .getVehicles()
      .then(setVehicles)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <Heading
        title="Vehicle Categories"
        subtitle="Select a category to view available transport vehicles and capacity."
      />

      {error ? <Notice message={error} /> : null}

      {loading ? (
        <Loading label="Loading vehicle categories..." />
      ) : (
        <View style={styles.list}>
          {VEHICLE_TYPES.map((item) => {
            const count = vehicles.filter(
              (v) => v.vehicleType === item.type && v.isAvailable
            ).length;
            const isSelected = selected === item.type;

            return (
              <Pressable
                key={item.type}
                style={[
                  styles.categoryCard,
                  shadows.soft,
                  isSelected && styles.categoryCardSelected
                ]}
                onPress={() =>
                  navigation.navigate("VehicleList", { vehicleType: item.type })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={28}
                      color={colors.primary}
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
                    <Text style={styles.idealText}>{item.idealFor}</Text>
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
    backgroundColor: colors.primaryLight
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "700"
  },
  idealText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2
  },
  descText: {
    color: colors.inkSecondary,
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
