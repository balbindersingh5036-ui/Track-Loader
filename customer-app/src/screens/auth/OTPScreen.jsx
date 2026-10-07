import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function OTPScreen({ navigation, route }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setError("Enter the 4-digit verification code sent to your phone.");
      return;
    }
    setError("");
    setBusy(true);
    if (route.params?.onVerified) {
      route.params.onVerified(otp.trim());
    } else {
      navigation.goBack();
    }
    setBusy(false);
  };

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          Enter the one-time password sent to your registered phone number.
        </Text>

        <View style={styles.card}>
          <Field
            label="Verification Code (OTP)"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="1234"
            icon={<Ionicons name="key-outline" size={18} color={colors.textMuted} />}
          />

          <Notice message={error} />

          <Button
            title="Verify & Continue"
            loading={busy}
            onPress={submit}
            style={{ marginTop: 6 }}
          />

          <Pressable
            onPress={() => setOtp("")}
            style={{ alignSelf: "center", paddingTop: 8 }}
          >
            <Text style={styles.resendText}>Didn't receive code? Resend</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  container: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    gap: 12
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  resendText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
