import React from "react";
import { Image, View, StyleSheet } from "react-native";
import { HEADER_LOGO_WIDTH, HEADER_LOGO_HEIGHT } from "../utils/logoHelper.mjs";

export default function LoadBalbinLogo({ style, width = HEADER_LOGO_WIDTH, height = HEADER_LOGO_HEIGHT }) {
  return (
    <View style={[styles.container, { height }, style]}>
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
