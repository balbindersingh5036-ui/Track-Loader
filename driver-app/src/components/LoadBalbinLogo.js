import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { HEADER_LOGO_WIDTH, HEADER_LOGO_HEIGHT } from '../utils/logoHelper.mjs';

const logoAsset = require('../../assets/loadbalbin-logo-cropped.png');

export default function LoadBalbinLogo({
  width = HEADER_LOGO_WIDTH,
  height = HEADER_LOGO_HEIGHT,
  style,
  imageStyle,
  resizeMode = 'contain',
  centered = false
}) {
  return (
    <View style={[styles.container, { height }, centered && styles.centeredContainer, style]}>
      <Image
        source={logoAsset}
        style={[styles.logo, { width, height }, centered && styles.centeredLogo, imageStyle]}
        resizeMode={resizeMode}
        accessibilityRole="image"
        accessibilityLabel="LoadBalbin Official Logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  centeredContainer: {
    alignItems: 'center'
  },
  logo: {
    alignSelf: 'flex-start'
  },
  centeredLogo: {
    alignSelf: 'center'
  }
});
