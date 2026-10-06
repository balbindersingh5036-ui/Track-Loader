import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function FeedbackScreen({ navigation, route }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!message.trim()) {
      setError("Please write your suggestion or feedback before submitting.");
      return;
    }
    setError("");
    if (route.params?.onSubmit) {
      route.params.onSubmit({ message: message.trim() });
    }
    setSubmitted(true);
    setTimeout(() => {
      navigation.goBack();
    }, 1200);
  };

  return (
    <Screen>
      <Heading
        title="App Feedback"
        subtitle="Help us improve the LoadBalbin experience."
      />

      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="bulb-outline" size={32} color={colors.primary} />
        </View>

        <Field
          label="Your Feedback or Feature Request"
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Share your thoughts, suggestions, or ideas..."
        />

        {error ? <Notice message={error} /> : null}
        {submitted ? <Notice message="Thank you! Your feedback has been recorded." tone="success" /> : null}

        <Button
          title="Submit Feedback"
          disabled={submitted}
          onPress={submit}
          style={{ marginTop: 8 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 14
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 4
  }
});
