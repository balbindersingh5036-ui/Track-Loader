import React from "react";
import { Text, View } from "react-native";
import { colors } from "./Phase12UI";

export default function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: "#FDECEA", borderRadius: 10, padding: 12 }}>
      <Text style={{ color: colors.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

