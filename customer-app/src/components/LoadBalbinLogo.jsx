import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 140, height = 50 }) {
  return (
    <View style={[styles.container, style]}>
      <Image 
        source={require("../../assets/logo.png")} 
        style={{ width, height, resizeMode: "contain" }} 
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
