import React, { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import vehicleService from "../../services/vehicleService";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, styles } from "../../components/Phase12UI";
import { getErrorMessage } from "../../utils/errorMessage";

export default function VehicleDetailsScreen({ route, navigation }) {
  const vehicleId = route.params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vehicleService.getVehicle(vehicleId)
      .then(setVehicle)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) return <Screen><Loading label="Loading vehicle..." /></Screen>;
  return (
    <Screen>
      {error ? <Notice message={error} /> : null}
      {vehicle ? (
        <>
          <Heading title={vehicle.vehicleModel} subtitle={vehicle.vehicleType.replaceAll("-", " ")} />
          {vehicle.vehicleImage ? <Image source={{ uri: vehicle.vehicleImage }} style={{ width: "100%", height: 210, borderRadius: 14 }} resizeMode="cover" /> : null}
          {(vehicle.vehicleImages || []).map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={{ width: "100%", height: 180, borderRadius: 14 }} resizeMode="cover" />)}
          <Card>
            <Text style={styles.muted}>Capacity: {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}</Text>
            <Text style={styles.muted}>Body type: {vehicle.bodyType || "Not specified"}</Text>
            <Text style={styles.muted}>Availability: {vehicle.isAvailable ? "Available" : "Unavailable"}</Text>
            <Text style={styles.muted}>Vehicle number: {vehicle.vehicleNumber || "Not provided"}</Text>
          </Card>
          <Button
            title="Book this vehicle"
            disabled={!vehicle.isAvailable}
            onPress={() => navigation.navigate("BookingLocation", { vehicleType: vehicle.vehicleType, vehicleId: vehicle._id })}
          />
        </>
      ) : !error ? <Empty title="Vehicle unavailable" /> : null}
    </Screen>
  );
}
