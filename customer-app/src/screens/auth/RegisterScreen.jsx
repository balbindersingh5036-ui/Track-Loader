import React, { useEffect, useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import authService from "../../services/authService";
import configService from "../../services/configService";
import { Button, Field, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";

export default function RegisterScreen({ navigation }) {
  const { establishSession } = useAuth();
  const [config, setConfig] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    configService
      .getPublicConfig()
      .then(setConfig)
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (config?.["customer.registrationEnabled"] === false) {
      setError("Customer registration is currently unavailable.");
      return;
    }
    setBusy(true);
    try {
      const details = {
        name: name.trim(),
        phone: phone.trim(),
        password
      };
      if (email.trim()) details.email = email.trim();
      const credentials = await authService.register(details);
      await establishSession(credentials);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const isRegistrationDisabled = config && config["customer.registrationEnabled"] === false;

  return (
    <Screen edges={["top", "bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="truck-fast" size={24} color={colors.white} />
            </View>
            <Text style={styles.brandName}>LoadBalbin</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Register as a customer to book verified transport vehicles.
          </Text>
        </View>

        {isRegistrationDisabled ? (
          <Notice
            message="Customer registration is currently disabled by administrator."
            tone="warning"
          />
        ) : null}

        <View style={styles.formCard}>
          <Field
            label="Full Name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            placeholder="e.g. Amit Sharma"
            icon={<Ionicons name="person-outline" size={18} color={colors.muted} />}
          />

          <Field
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="e.g. 9001000001"
            icon={<Ionicons name="call-outline" size={18} color={colors.muted} />}
          />

          <Field
            label="Email Address (Optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="name@example.com"
            icon={<Ionicons name="mail-outline" size={18} color={colors.muted} />}
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.muted} />}
            rightIcon={
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.muted}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          <Notice message={error} />

          <Button
            title="Create Account"
            loading={busy}
            disabled={!config || isRegistrationDisabled}
            onPress={submit}
            style={{ marginTop: 6 }}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable
            onPress={() => navigation.navigate("Login")}
            hitSlop={8}
          >
            <Text style={styles.loginLink}>Sign In</Text>
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
    maxWidth: 440,
    alignSelf: "center",
    gap: 18
  },
  header: {
    alignItems: "center",
    gap: 6
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  brandName: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  title: {
    color: colors.navy,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  },
  formCard: {
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8
  },
  footerText: {
    color: colors.muted,
    fontSize: 14
  },
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700"
  }
});
