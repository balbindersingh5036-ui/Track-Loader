import React from "react";
import { Pressable, Text, View } from "react-native";
import { Card, Heading, Screen, colors } from "../../components/Phase12UI";

const VEHICLE_TYPES = ["mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"];

export default function VehicleTypeScreen({ navigation, route }) {
  const selected = route.params?.vehicleType;

  return (
    <Screen>
      <Heading title="Choose a vehicle type" subtitle="Select the type you need for this booking." />
      <View style={{ gap: 10 }}>
        {VEHICLE_TYPES.map((type) => (
          <Pressable key={type} onPress={() => navigation.navigate("VehicleList", { vehicleType: type })}>
            <Card style={{ borderColor: selected === type ? colors.primary : colors.line, backgroundColor: selected === type ? "#E6F7F4" : "#FFFFFF" }}>
              <Text style={{ color: colors.ink, fontWeight: "700" }}>{type.replace(/-/g, " ")}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

