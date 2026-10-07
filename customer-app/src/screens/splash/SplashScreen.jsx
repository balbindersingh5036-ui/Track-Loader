import React from "react";
import { Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Notice } from "../../components/Phase12UI";
import LoadBalbinLogo from "../../components/LoadBalbinLogo";
import { colors } from "../../theme/theme";

export default function SplashScreen({ error, onRetry }) {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <LoadBalbinLogo width={200} height={60} />
      </View>
      <View style={styles.logoWrap}>
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
    backgroundColor: colors.background
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
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  tagline: {
    color: colors.textMuted,
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
