import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 175, height = 56 }) {
  return (
    <Image
      source={require("../../assets/loadbalbin-logo-cropped.png")}
      style={[styles.logo, { width, height }, style]}
      resizeMode="contain"
      accessibilityLabel="Load Balbin - For Driver & Transporter"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: "flex-start",
  },
});
