import React from "react";
import { Image, View, StyleSheet } from "react-native";

export default function LoadBalbinLogo({ style, width = 140, height = 45 }) {
  return (
    <View style={[{ width, height, maxWidth: 240, maxHeight: 64, justifyContent: 'center', alignItems: 'flex-start' }, style]}>
      <Image 
        source={require("../../assets/loadbalbin-logo-cropped.png")} 
        style={{ width: '100%', height: '100%' }} 
        resizeMode="contain"
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
