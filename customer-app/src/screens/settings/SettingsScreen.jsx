import React from "react";
import { Text, View } from "react-native";
import { Card, Heading, Screen, colors } from "../../components/Phase12UI";

export default function SettingsScreen() {
  return (
    <Screen>
      <Heading title="Settings" subtitle="Manage your customer preferences." />
      <Card>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>Notifications</Text>
        <Text style={{ color: colors.muted }}>Your notification preferences are managed from the app and backend controls.</Text>
      </Card>
      <Card>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>Privacy</Text>
        <Text style={{ color: colors.muted }}>Your profile and booking details are stored by LoadBalbin only as needed for service fulfilment.</Text>
      </Card>
    </Screen>
  );
}

