import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconFamily = 'Ionicons',
  iconColor = theme.colors.primary,
  badgeText,
  badgeColor,
  onPress,
  style
}) {
  const IconComp = iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
  const isPressable = typeof onPress === 'function';

  const content = (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}18` }]}>
          <IconComp name={icon} size={20} color={iconColor} />
        </View>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: `${badgeColor || iconColor}18` }]}>
            <Text style={[styles.badgeText, { color: badgeColor || iconColor }]}>{badgeText}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value} numberOfLines={1}>{value ?? '0'}</Text>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );

  if (isPressable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressableWrapper,
          pressed && styles.pressed
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pressableWrapper: {
    flex: 1
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  value: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 2
  }
});
