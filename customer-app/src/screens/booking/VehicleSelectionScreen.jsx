import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import vehicleService from "../../services/vehicleService";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, styles, colors } from "../../components/Phase12UI";
import { getErrorMessage } from "../../utils/errorMessage";

export default function VehicleSelectionScreen({ route, navigation }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(route.params?.vehicleId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vehicleService.getVehicles(route.params?.vehicleType ? { vehicleType: route.params.vehicleType } : {})
      .then(setVehicles)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [route.params?.vehicleType]);

  const continueToConfirm = () => {
    const selected = vehicles.find((vehicle) => vehicle._id === selectedId);
    if (selectedId && !selected) {
      setError("That vehicle is no longer available. Choose another vehicle.");
      return;
    }
    navigation.navigate("BookingConfirm", {
      ...route.params,
      vehicleType: selected?.vehicleType || route.params?.vehicleType || "mini-truck",
      vehicleId: selected?._id || null,
      vehicle: selected || null
    });
  };

  return (
    <Screen>
      <Heading title="Choose a vehicle" subtitle="Select an available vehicle or leave this optional to let a driver assign one." />
      {route.params?.vehicleType ? <Text style={styles.muted}>Type: {route.params.vehicleType.replaceAll("-", " ")}</Text> : null}
      {error ? <Notice message={error} /> : null}
      {loading ? <Loading label="Loading matching vehicles..." /> : null}
      {!loading && !error && !vehicles.length ? <Empty title="No matching vehicle is listed" detail="You can still request a driver assignment." /> : null}
      {!loading ? (
        <Pressable onPress={() => setSelectedId("")}>
          <Card style={{ borderColor: selectedId ? colors.line : colors.primary }}>
            <Text style={styles.cardTitle}>No vehicle preference</Text>
            <Text style={styles.muted}>A suitable driver vehicle can be assigned to this request.</Text>
          </Card>
        </Pressable>
      ) : null}
      {vehicles.map((vehicle) => (
        <Pressable key={vehicle._id} onPress={() => setSelectedId(vehicle._id)}>
          <Card style={{ borderColor: selectedId === vehicle._id ? colors.primary : colors.line }}>
            <Text style={styles.cardTitle}>{vehicle.vehicleModel}</Text>
            <Text style={styles.muted}>{vehicle.vehicleType.replaceAll("-", " ")} · {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit} · {vehicle.bodyType || "Body not specified"}</Text>
          </Card>
        </Pressable>
      ))}
      {!loading ? <Button title="Review booking" onPress={continueToConfirm} /> : null}
    </Screen>
  );
}
