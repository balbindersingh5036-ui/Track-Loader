import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 140, height = 45 }) {
  return (
    <View style={[styles.container, style, { width, height, overflow: "visible" }]}>
      <Image 
        source={require("../../assets/logo.png")} 
        style={{ width: width * 1.8, height: height * 1.8, resizeMode: "contain", transform: [{ scale: 1.2 }] }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
