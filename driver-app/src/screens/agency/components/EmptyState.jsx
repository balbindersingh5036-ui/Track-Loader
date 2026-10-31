import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';

export default function EmptyState({
  icon = 'cube-outline',
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  style
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  title: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center'
  },
  description: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.md,
    marginTop: 10
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  }
});
