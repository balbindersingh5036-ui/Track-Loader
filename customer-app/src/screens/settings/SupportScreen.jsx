import React from "react";
import { Text } from "react-native";
import { Card, Heading, Screen, colors } from "../../components/Phase12UI";

export default function SupportScreen({ route }) {
  const supportPhone = route?.params?.supportPhone || "Not provided";
  const supportEmail = route?.params?.supportEmail || "support@loadbalbin.com";

  return (
    <Screen>
      <Heading title="Support" subtitle="We are here to help with your booking and account needs." />
      <Card>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>Phone</Text>
        <Text style={{ color: colors.muted }}>{supportPhone}</Text>
      </Card>
      <Card>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>Email</Text>
        <Text style={{ color: colors.muted }}>{supportEmail}</Text>
      </Card>
    </Screen>
  );
}

