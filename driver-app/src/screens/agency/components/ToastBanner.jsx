import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';

export default function ToastBanner({ type = 'error', message, onDismiss, onRetry, style }) {
  if (!message) return null;

  const isError = type === 'error';
  const isSuccess = type === 'success';

  const bgColor = isError ? '#321419' : isSuccess ? '#0F2E23' : '#142539';
  const borderColor = isError ? theme.colors.danger : isSuccess ? theme.colors.green : theme.colors.primary;
  const iconName = isError ? 'alert-circle' : isSuccess ? 'checkmark-circle' : 'information-circle';
  const iconColor = isError ? theme.colors.danger : isSuccess ? theme.colors.green : theme.colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }, style]}>
      <Ionicons name={iconName} size={20} color={iconColor} style={styles.icon} />
      <Text style={styles.text} numberOfLines={3}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={18} color={theme.colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 10
  },
  icon: {
    marginRight: 2
  },
  text: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.sm
  },
  retryText: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: '700'
  },
  dismissButton: {
    padding: 4
  }
});
