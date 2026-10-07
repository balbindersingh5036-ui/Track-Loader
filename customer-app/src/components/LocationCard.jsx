import React from "react";
import { Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function LocationCard({ label, location, compact }) {
  const value = location?.address || location || "Not provided";
  return (
    <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: colors.textLight, fontWeight: "700", marginBottom: 4 }}>{label || "Location"}</Text>
      <Text style={{ color: colors.textMuted, fontSize: compact ? 12 : 14 }}>{value}</Text>
    </View>
  );
}

