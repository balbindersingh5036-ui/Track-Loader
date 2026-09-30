import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Heading, Notice, Screen } from "../../components/Phase12UI";

export default function FeedbackScreen({ navigation, route }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!message.trim()) {
      setError("Please the share your feedback before submitting.");
      return;
    }
    setError("");
    if (route.params?.onSubmit) route.params.onSubmit({ message: message.trim() });
    navigation.goBack();
  };

  return (
    <Screen>
      <Heading title="Feedback" subtitle="Tell us how we can improve your experience." />
      <Field label="Message" value={message} onChangeText={setMessage} multiline placeholder="Share your feedback" />
      {error ? <Notice message={error} /> : null}
      <Button title="Submit feedback" onPress={submit} />
    </Screen>
  );
}

