import React, { useState } from "react";
import { Button, Field, Heading, Notice, Screen } from "../../components/Phase12UI";

export default function LocationScreen({ route, navigation }) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropAddress, setDropAddress] = useState("");
  const [error, setError] = useState("");

  const continueToGoods = () => {
    setError("");
    if (!pickupAddress.trim()) {
      setError("Enter pickup location.");
      return;
    }
    if (!dropAddress.trim()) {
      setError("Enter drop location.");
      return;
    }

    const pickup = {
      address: pickupAddress.trim(),
      latitude: 20.5937,
      longitude: 78.9629
    };
    const drop = {
      address: dropAddress.trim(),
      latitude: 20.5937,
      longitude: 78.9629
    };

    navigation.navigate("BookingGoods", {
      pickup,
      drop,
      vehicleType: route.params?.vehicleType,
      vehicleId: route.params?.vehicleId
    });
  };

  return (
    <Screen>
      <Heading
        title="Pickup and drop location"
        subtitle="Enter your pickup and drop locations to continue."
      />
      <Field
        label="Pickup Location"
        value={pickupAddress}
        onChangeText={setPickupAddress}
        placeholder="Enter pickup location"
      />
      <Field
        label="Drop Location"
        value={dropAddress}
        onChangeText={setDropAddress}
        placeholder="Enter drop location"
      />
      <Notice message={error} />
      <Button title="Continue" onPress={continueToGoods} />
    </Screen>
  );
}

