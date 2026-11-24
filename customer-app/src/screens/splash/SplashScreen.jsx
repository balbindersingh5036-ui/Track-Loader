import React from "react";
import { Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { Button, Notice } from "../../components/Phase12UI";
import LoadBalbinLogo from "../../components/LoadBalbinLogo";
import { colors } from "../../theme/theme";

export default function SplashScreen({ error, onRetry, onSignOut }) {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <LoadBalbinLogo width={220} height={180} centered resizeMode="contain" />
      </View>
      <View style={styles.taglineWrap}>
        <Text style={styles.tagline}>Move goods with confidence.</Text>
      </View>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBox}>
            <Notice message={error} />
            <Button title="Try Again" onPress={onRetry} style={{ marginTop: 12 }} />
            {typeof onSignOut === "function" && (
              <Button
                title="Go to Login"
                variant="outline"
                onPress={onSignOut}
                style={{ marginTop: 8 }}
              />
            )}
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
    justifyContent: "center",
    marginBottom: 8
  },
  taglineWrap: {
    alignItems: "center",
    marginTop: 6
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
