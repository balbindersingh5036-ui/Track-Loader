import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({
  style,
  imageStyle,
  width = 95,
  height = 90,
  resizeMode = "contain",
  centered = false
}) {
  return (
    <View style={[styles.container, centered && styles.centeredContainer, style]}>
      <Image
        source={require("../../assets/loadbalbin-logo-cropped.png")}
        style={[styles.logo, { width, height }, centered && styles.centeredLogo, imageStyle]}
        resizeMode={resizeMode}
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
  centeredContainer: {
    alignItems: "center",
  },
  logo: {
    alignSelf: "flex-start",
    opacity: 1,
    zIndex: 1,
  },
  centeredLogo: {
    alignSelf: "center",
  },
});
