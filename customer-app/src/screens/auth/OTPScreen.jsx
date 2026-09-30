import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Heading, Notice, Screen } from "../../components/Phase12UI";

export default function OTPScreen({ navigation, route }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setError("Enter the 4-digit OTP sent to your phone.");
      return;
    }
    setError("");
    if (route.params?.onVerified) route.params.onVerified(otp.trim());
    else navigation.goBack();
  };

  return (
    <Screen>
      <Heading title="Verify code" subtitle="Enter the one-time password to continue." />
      <Field label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="1234" />
      {error ? <Notice message={error} /> : null}
      <Button title="Verify" onPress={submit} />
    </Screen>
  );
}

