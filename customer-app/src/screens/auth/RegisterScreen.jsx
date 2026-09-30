import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import authService from "../../services/authService";
import configService from "../../services/configService";
import { Button, Field, Heading, Notice, Screen, colors } from "../../components/Phase12UI";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";

export default function RegisterScreen({ navigation }) {
  const { establishSession } = useAuth();
  const [config, setConfig] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    configService.getPublicConfig().then(setConfig).catch((requestError) => setError(getErrorMessage(requestError)));
  }, []);

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!name.trim() || !phone.trim() || password.length < 6) {
      setError("Enter your name and phone number. Passwords need at least 6 characters.");
      return;
    }
    if (config?.["customer.registrationEnabled"] === false) {
      setError("Customer registration is currently unavailable.");
      return;
    }
    setBusy(true);
    try {
      const details = { name: name.trim(), phone: phone.trim(), password };
      if (email.trim()) details.email = email.trim();
      const credentials = await authService.register(details);
      await establishSession(credentials);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ flexGrow: 1, justifyContent: "center" }}>
      <Heading title="Create your account" subtitle="Register as a LoadBalbin customer." />
      {config?.["customer.registrationEnabled"] === false ? (
        <Notice message="Customer registration is currently unavailable." tone="warning" />
      ) : null}
      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Notice message={error} />
      <Button
        title="Create account"
        loading={busy}
        disabled={!config || config["customer.registrationEnabled"] === false}
        onPress={submit}
      />
      <Pressable onPress={() => navigation.navigate("Login")} style={{ padding: 12, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontWeight: "700" }}>Already registered? Sign in</Text>
      </Pressable>
    </Screen>
  );
}
