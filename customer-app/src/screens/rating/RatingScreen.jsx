import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ratingService from "../../services/ratingService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function RatingScreen({ navigation, route }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (rating < 1 || busy) {
      if (rating < 1) setError("Please select a star rating from 1 to 5.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ratingService.createRating({
        bookingId: route.params?.bookingId,
        rating,
        feedback: feedback.trim()
      });
      navigation.goBack();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const starLabels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];

  return (
    <Screen>
      <Heading
        title="Rate Delivery Service"
        subtitle="How was your experience with the driver and goods delivery?"
      />

      <Card style={styles.ratingCard}>
        <Text style={styles.cardHeaderTitle}>Overall Satisfaction</Text>

        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => {
            const isFilled = rating >= value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setRating(value);
                  setError("");
                }}
                style={styles.starBtn}
                hitSlop={6}
              >
                <Ionicons
                  name={isFilled ? "star" : "star-outline"}
                  size={36}
                  color={isFilled ? "#F59E0B" : colors.mutedLight}
                />
              </Pressable>
            );
          })}
        </View>

        {rating > 0 ? (
          <Text style={styles.ratingVerdictText}>{starLabels[rating - 1]}</Text>
        ) : null}

        <Field
          label="Tell us about your experience (Optional)"
          value={feedback}
          onChangeText={setFeedback}
          multiline
          placeholder="e.g. Prompt arrival, polite driver, careful handling of cargo..."
          icon={<Ionicons name="chatbox-ellipses-outline" size={18} color={colors.muted} />}
        />

        <Notice message={error} />

        <Button
          title="Submit Rating"
          loading={busy}
          disabled={rating < 1}
          onPress={submit}
          style={{ marginTop: 8 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratingCard: {
    padding: 20,
    gap: 14,
    alignItems: "stretch"
  },
  cardHeaderTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10
  },
  starBtn: {
    padding: 4
  },
  ratingVerdictText: {
    color: "#D97706",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 4
  }
});
