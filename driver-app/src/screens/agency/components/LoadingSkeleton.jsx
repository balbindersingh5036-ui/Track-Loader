import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from './AgencyTheme';

export default function LoadingSkeleton({ count = 3, cardHeight = 110, style }) {
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.skeletonCard, { minHeight: cardHeight }]}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonCircle} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[styles.skeletonLine, { width: '60%' }]} />
              <View style={[styles.skeletonLine, { width: '40%', height: 10 }]} />
            </View>
            <View style={[styles.skeletonBadge, { width: 60 }]} />
          </View>
          <View style={[styles.skeletonLine, { width: '85%', marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '70%', height: 10 }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 8
  },
  skeletonCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 10,
    opacity: 0.6
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  skeletonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surface
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: theme.colors.surface
  },
  skeletonBadge: {
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surface
  }
});
