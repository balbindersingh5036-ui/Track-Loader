import React from 'react';
import { Platform } from 'react-native';
import RouteMapWeb from './RouteMap.web';
import RouteMapNative from './RouteMap.native';

export default function RouteMap(props) {
  if (Platform.OS === 'web') {
    return <RouteMapWeb {...props} />;
  }
  return <RouteMapNative {...props} />;
}
