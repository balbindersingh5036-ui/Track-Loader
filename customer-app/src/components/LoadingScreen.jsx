import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function LoadingScreen({ label = "Loading..." }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F4F7F6" }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
    </View>
  );
}

