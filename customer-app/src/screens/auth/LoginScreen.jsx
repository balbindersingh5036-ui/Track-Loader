import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import authService from "../../services/authService";
import { Button, Field, Heading, Notice, Screen, colors } from "../../components/Phase12UI";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";

export default function LoginScreen({ navigation }) {
  const { establishSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!phone.trim() || !password) {
      setError("Enter your phone number and password.");
      return;
    }
    setBusy(true);
    try {
      const credentials = await authService.login({ phone: phone.trim(), password });
      await establishSession(credentials);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center" }}>
      <Heading title="Welcome back" subtitle="Sign in to manage your goods transport bookings." />
      <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Notice message={error} />
      <Button title="Sign in" loading={busy} onPress={submit} />
      <Pressable onPress={() => navigation.navigate("Register")} style={{ padding: 12, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>Create a customer account</Text>
      </Pressable>
    </Screen>
  );
}
