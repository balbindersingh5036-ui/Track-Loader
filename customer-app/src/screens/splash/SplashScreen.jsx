import React from "react";
import { Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Notice } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function SplashScreen({ error, onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="truck-fast" size={44} color={colors.white} />
        </View>
        <Text style={styles.brandTitle}>LoadBalbin</Text>
        <Text style={styles.tagline}>Move goods with confidence.</Text>
      </View>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBox}>
            <Notice message={error} />
            <Button title="Try Again" onPress={onRetry} style={{ marginTop: 12 }} />
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
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.canvas
  },
  logoWrap: {
    alignItems: "center",
    gap: 8
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6
  },
  brandTitle: {
    color: colors.navy,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "500"
  },
  footer: {
    position: "absolute",
    bottom: 48,
    width: "100%",
    maxWidth: 320,
    alignItems: "center"
  },
  errorBox: {
    width: "100%",
    gap: 8
  }
});
