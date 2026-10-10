import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 140, height = 90 }) {
  return (
    <Image
      source={require("../../assets/loadbalbin-logo-cropped.png")}
      style={[styles.logo, { width, height, transform: [{ translateX: -25 }] }, style]}
      resizeMode="contain"
      accessibilityLabel="Load Balbin - For Driver & Transporter"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: "flex-start",
    opacity: 1,
    zIndex: 1,
  },
});
