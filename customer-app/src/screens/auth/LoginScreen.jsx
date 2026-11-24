import React, { useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import authService from "../../services/authService";
import { Button, Field, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";
import LoadBalbinLogo from "../../components/LoadBalbinLogo";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";
import { validateLoginIdentifier, buildLoginPayload } from "../../utils/authValidation";

export default function LoginScreen({ navigation }) {
  const { establishSession } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    setError("");

    const validation = validateLoginIdentifier(identifier);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setBusy(true);
    try {
      const payload = buildLoginPayload(identifier, password);
      const credentials = await authService.login(payload);
      await establishSession(credentials);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const isEmail = identifier.includes("@");

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <LoadBalbinLogo width={160} height={45} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to manage your goods transport bookings.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Field
            label="Mobile Number / Email Address"
            value={identifier}
            onChangeText={(val) => {
              setIdentifier(val);
              if (error) setError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder="Enter mobile number or email address"
            icon={
              <Ionicons
                name={isEmail ? "mail-outline" : "call-outline"}
                size={18}
                color={colors.textMuted}
              />
            }
          />

          <Field
            label="Password"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (error) setError("");
            }}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />}
            rightIcon={
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textMuted}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <Notice message={error} />

          <Button
            title="Sign In"
            loading={busy}
            onPress={submit}
            style={{ marginTop: 6 }}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable
            onPress={() => navigation.navigate("Register")}
            hitSlop={8}
          >
            <Text style={styles.registerLink}>Create a customer account</Text>
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
  keyboardView: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 20
  },
  header: {
    gap: 6
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    paddingVertical: 8
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14
  },
  registerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  }
});
