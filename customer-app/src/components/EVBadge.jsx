import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { isEVVehicle } from "../utils/vehicleDisplay";

/**
 * Professional EV badge for LoadBalbin customer app.
 * Renders ONLY for EV_GOODS vehicles.
 * Styling is tailored to LoadBalbin dark-blue UI with clean emerald/green accent.
 */
export default function EVBadge({
  vehicle,
  serviceCategory,
  size = "small",
  showIcon = true,
  style,
  textStyle
}) {
  const isEV = isEVVehicle(vehicle || (serviceCategory ? { serviceCategory } : null));
  if (!isEV) return null;

  const isSmall = size === "small";

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium, style]}>
      {showIcon ? (
        <MaterialCommunityIcons
          name="lightning-bolt"
          size={isSmall ? 11 : 13}
          color="#10B981"
        />
      ) : null}
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textMedium, textStyle]}>
        EV
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.45)",
    borderRadius: 6,
    alignSelf: "flex-start"
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7
  },
  text: {
    color: "#10B981",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  textSmall: {
    fontSize: 10,
    lineHeight: 12
  },
  textMedium: {
    fontSize: 11,
    lineHeight: 14
  }
});
