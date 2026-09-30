import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function VehicleCard({ vehicle, onPress }) {
  if (!vehicle) return null;

  return (
    <Pressable onPress={onPress} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {vehicle.vehicleImage ? (
          <Image source={{ uri: vehicle.vehicleImage }} style={{ width: 84, height: 64, borderRadius: 10 }} resizeMode="cover" />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700" }}>{vehicle.vehicleModel || "Vehicle"}</Text>
          <Text style={{ color: colors.muted }}>{vehicle.vehicleType ? vehicle.vehicleType.replace(/-/g, " ") : "Unknown type"}</Text>
          <Text style={{ color: colors.muted }}>
            {vehicle.loadCapacity?.value || vehicle.capacity || "—"} {vehicle.loadCapacity?.unit || "units"}
          </Text>
        </View>
      </View>
      <Text style={{ color: vehicle.isAvailable ? colors.success : colors.warning, marginTop: 10, fontWeight: "700" }}>
        {vehicle.isAvailable ? "Available" : "Unavailable"}
      </Text>
    </Pressable>
  );
}

