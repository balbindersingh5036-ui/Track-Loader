import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import LoadBalbinLogo from '../../components/LoadBalbinLogo';

const colors = {
  bg: '#08111F',
  surface: '#0F1B29',
  border: '#25364A',
  ink: '#FFFFFF',
  muted: '#8A98A8',
  primary: '#08A9F5',
  danger: '#EF4444'
};

export default function SplashScreen({ error, onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <LoadBalbinLogo width={220} height={180} centered resizeMode="contain" />
      </View>
      <View style={styles.taglineWrap}>
        <Text style={styles.tagline}>Empowering Drivers & Transporters.</Text>
      </View>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
            {typeof onRetry === 'function' ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bg
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  taglineWrap: {
    alignItems: 'center',
    marginTop: 6
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '500'
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center'
  },
  errorBox: {
    width: '100%',
    gap: 12,
    alignItems: 'center'
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center'
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
