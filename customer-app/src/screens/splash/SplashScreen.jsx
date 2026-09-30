import React from "react";
import { Text, View } from "react-native";
import { Button, colors, Notice } from "../../components/Phase12UI";

export default function SplashScreen({ error, onRetry }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F4F7F6", gap: 14 }}>
      <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "800" }}>LoadBalbin</Text>
      <Text style={{ color: colors.muted, fontSize: 16 }}>Goods transportation, made simple.</Text>
      {error ? <Notice message={error} /> : null}
      {error ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}
