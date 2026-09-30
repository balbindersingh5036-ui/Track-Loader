import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Heading, Screen, colors } from "../../components/Phase12UI";

export default function RatingScreen({ navigation, route }) {
  const [rating, setRating] = useState(0);

  const submit = () => {
    if (rating < 1) return;
    if (route.params?.onSubmit) route.params.onSubmit(rating);
    navigation.goBack();
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
      <Button title="Submit rating" disabled={rating < 1} onPress={submit} />
    </Screen>
  );
}

