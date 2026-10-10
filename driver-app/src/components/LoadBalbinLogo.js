import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 140, height = 90 }) {
  return (
    <View style={[{ width, height, maxWidth: 240, maxHeight: 64, justifyContent: 'center', alignItems: 'flex-start' }, style]}>
      <Image
        source={require("../../assets/loadbalbin-logo-cropped.png")}
        style={[styles.logo, { width: '100%', height: '100%' }]}
        resizeMode="contain"
        accessibilityLabel="Load Balbin - For Driver & Transporter"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: "flex-start",
    opacity: 1,
    zIndex: 1,
  },
});
