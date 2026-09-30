import React from "react";
import { Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function StatusBadge({ status, label }) {
  const resolved = (label || status || "unknown").replace(/-/g, " ");
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: "#DDF3EF", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9 }}>
      <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>{resolved.toUpperCase()}</Text>
    </View>
  );
}

