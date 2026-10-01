import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import ratingService from "../../services/ratingService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Field, Heading, Notice, Screen, colors } from "../../components/Phase12UI";

export default function RatingScreen({ navigation, route }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (rating < 1 || busy) {
      if (rating < 1) setError("Please choose a rating from 1 to 5.");
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

  return (
    <Screen>
      <Heading title="Rate your experience" subtitle="How satisfied are you with the delivery service?" />
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 18 }}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setRating(value)} style={{ alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 22, backgroundColor: rating >= value ? colors.primary : "#EAEFEE" }}>
            <Text style={{ color: rating >= value ? "#FFFFFF" : colors.ink, fontSize: 20, fontWeight: "700" }}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Feedback (optional)" value={feedback} onChangeText={setFeedback} multiline placeholder="Share feedback about your delivery" />
      {error ? <Notice message={error} /> : null}
      <Button title="Submit rating" loading={busy} disabled={rating < 1} onPress={submit} />
    </Screen>
  );
}
