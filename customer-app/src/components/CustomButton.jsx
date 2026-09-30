import React from "react";
import { Pressable, Text } from "react-native";
import { colors } from "./Phase12UI";

export default function CustomButton({ title, onPress, disabled, secondary, loading, style }) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        alignItems: "center",
        justifyContent: "center",
        minHeight: 46,
        borderRadius: 12,
        backgroundColor: secondary ? "#FFFFFF" : colors.primary,
        borderWidth: secondary ? 1 : 0,
        borderColor: secondary ? colors.primary : "transparent",
        opacity: disabled || loading ? 0.6 : 1,
        paddingHorizontal: 16,
        marginVertical: 6,
        transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
        ...(style || {})
      })}
    >
      <Text style={{ color: secondary ? colors.primary : "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
        {loading ? "Loading..." : title}
      </Text>
    </Pressable>
  );
}

