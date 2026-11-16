import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 95, height = 90 }) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require("../../assets/loadbalbin-logo-cropped.png")}
        style={[styles.logo, { width, height }]}
        resizeMode="contain"
        accessibilityLabel="Load Balbin - For Driver & Transporter"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logo: {
    alignSelf: "flex-start",
    opacity: 1,
    zIndex: 1,
  },
});
