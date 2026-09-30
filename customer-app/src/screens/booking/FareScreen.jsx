import React from "react";
import { Text, View } from "react-native";
import { Button, Card, Heading, Screen, colors } from "../../components/Phase12UI";

export default function FareScreen({ route, navigation }) {
  const { totalFare, weight, distance, vehicleType } = route.params || {};

  return (
    <Screen>
      <Heading title="Fare estimate" subtitle="The backend calculates the final fare for the booking." />
      <Card>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>Estimated total</Text>
        <Text style={{ color: colors.primary, fontSize: 30, fontWeight: "800", marginTop: 8 }}>₹{Number(totalFare || 0).toFixed(2)}</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>Vehicle type: {vehicleType || "Not selected"}</Text>
        <Text style={{ color: colors.muted }}>Weight: {weight || "—"}</Text>
        <Text style={{ color: colors.muted }}>Distance: {distance || "—"}</Text>
      </Card>
      <Button title="Continue" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

