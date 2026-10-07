import React from "react";
import { Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function EmptyState({ title, detail }) {
  return (
    <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18 }}>
      <Text style={{ color: colors.textLight, fontSize: 17, fontWeight: "700" }}>{title || "No records found"}</Text>
      {detail ? <Text style={{ color: colors.textMuted, marginTop: 6 }}>{detail}</Text> : null}
    </View>
  );
}

