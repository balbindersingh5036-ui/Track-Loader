import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { colors } from "./Phase12UI";
import {
  getCleanVehicleDisplayName,
  formatVehicleCategory,
  getVehicleCategoryLabel,
  isEVVehicle
} from "../utils/vehicleDisplay";
import EVBadge from "./EVBadge";

export default function VehicleCard({ vehicle, onPress }) {
  if (!vehicle) return null;

  const isEV = isEVVehicle(vehicle);

  return (
    <Pressable onPress={onPress} style={{ backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {vehicle.vehicleImage ? (
          <View style={{ position: "relative" }}>
            <Image source={{ uri: vehicle.vehicleImage }} style={{ width: 84, height: 64, borderRadius: 10 }} resizeMode="cover" />
            {isEV ? (
              <View style={{ position: "absolute", top: 4, left: 4 }}>
                <EVBadge vehicle={vehicle} size="small" />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.textLight, fontSize: 16, fontWeight: "700", flexShrink: 1 }}>
              {getCleanVehicleDisplayName(vehicle)}
            </Text>
            <EVBadge vehicle={vehicle} size="small" />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{
              backgroundColor: isEV ? "rgba(16, 185, 129, 0.15)" : "rgba(8, 169, 245, 0.12)",
              paddingHorizontal: 6,
              paddingVertical: 1.5,
              borderRadius: 4
            }}>
              <Text style={{
                color: isEV ? "#059669" : colors.primaryDark,
                fontSize: 10,
                fontWeight: "700"
              }}>
                {getVehicleCategoryLabel(vehicle)}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {formatVehicleCategory(vehicle.vehicleType)}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
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

