import React, { useState } from "react";
import { Text } from "react-native";
import { Button, Field, Heading, Notice, Screen, styles } from "../../components/Phase12UI";

export default function GoodsDetailsScreen({ route, navigation }) {
  const [goods, setGoods] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [preferredPickupDate, setPreferredPickupDate] = useState("");
  const [preferredPickupTime, setPreferredPickupTime] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [error, setError] = useState("");

  const continueToVehicle = () => {
    setError("");
    const weight = Number(weightValue);
    if (!goods.trim()) return setError("Describe the goods being transported.");
    if (!weightValue.trim() || !Number.isFinite(weight) || weight < 0) return setError("Enter a valid non-negative weight.");
    if (!["kg", "ton"].includes(weightUnit)) return setError("Choose kilograms or tons.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredPickupDate) || Number.isNaN(Date.parse(preferredPickupDate))) {
      return setError("Enter the pickup date as YYYY-MM-DD.");
    }
    if (!/^\d{2}:\d{2}$/.test(preferredPickupTime)) return setError("Enter pickup time as HH:MM.");

    navigation.navigate("BookingVehicle", {
      ...route.params,
      goods: goods.trim(),
      weight: { value: weight, unit: weightUnit },
      preferredPickupDate,
      preferredPickupTime,
      customerNote: customerNote.trim()
    });
  };

  return (
    <Screen>
      <Heading title="Goods details" subtitle="Add a short description and an estimated weight." />
      <Field label="Goods" value={goods} onChangeText={setGoods} placeholder="e.g. Furniture, cartons" />
      <Field label="Weight" value={weightValue} onChangeText={setWeightValue} keyboardType="decimal-pad" placeholder="0" />
      <Text style={styles.label}>Weight unit</Text>
      <Text onPress={() => setWeightUnit(weightUnit === "kg" ? "ton" : "kg")} style={styles.link}>
        {weightUnit === "kg" ? "Kilograms (kg) · tap to use tons" : "Tons · tap to use kilograms"}
      </Text>
      <Field label="Preferred pickup date" value={preferredPickupDate} onChangeText={setPreferredPickupDate} placeholder="YYYY-MM-DD" />
      <Field label="Preferred pickup time" value={preferredPickupTime} onChangeText={setPreferredPickupTime} placeholder="HH:MM" />
      <Field label="Note for the driver (optional)" value={customerNote} onChangeText={setCustomerNote} multiline placeholder="Any handling instructions?" />
      <Notice message={error} />
      <Button title="Choose a vehicle" onPress={continueToVehicle} />
    </Screen>
  );
}
