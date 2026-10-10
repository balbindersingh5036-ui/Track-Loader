import React from "react";
import { Image, View, StyleSheet, Platform } from "react-native";

export default function LoadBalbinLogo({ style, width = 320, height = 86 }) {
  return (
    <View style={[{ width, height, justifyContent: 'center', alignItems: 'flex-start', overflow: 'visible' }, style]}>
      <Image
        source={require("../../assets/loadbalbin-logo-cropped.png")}
        style={[
          styles.logo, 
          { width: '100%', height: '100%', position: 'absolute', left: -40, transform: [{ translateX: -20 }] },
          Platform.OS === 'web' ? { objectPosition: 'left center' } : {}
        ]}
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
