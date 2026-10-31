import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusConfig } from './AgencyTheme';

export default function StatusBadge({ status, label, style, textStyle, size = 'md' }) {
  const config = statusConfig(status);
  const displayLabel = label || config.label;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 9,
          borderRadius: isSmall ? 6 : 8
        },
        style
      ]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: config.color,
            width: isSmall ? 5 : 6,
            height: isSmall ? 5 : 6,
            borderRadius: isSmall ? 3 : 4
          }
        ]}
      />
      <Text
        style={[
          styles.label,
          {
            color: config.color,
            fontSize: isSmall ? 10 : 11
          },
          textStyle
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5
  },
  dot: {
    marginRight: 2
  },
  label: {
    fontWeight: '700',
    textTransform: 'capitalize'
  }
});
