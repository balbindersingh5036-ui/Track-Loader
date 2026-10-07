import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function VehicleTypeCard({ title, count, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 14, borderWidth: 1, borderColor: selected ? colors.primary : colors.line, backgroundColor: selected ? "#E6F7F4" : "#FFFFFF", padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textLight, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>{count ?? 0}</Text>
      </View>
    </Pressable>
  );
}

