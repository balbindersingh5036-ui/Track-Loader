import React, { useState } from "react";
import { Text } from "react-native";
import configService from "../../services/configService";
import bookingService from "../../services/bookingService";
import { Button, Card, Heading, Notice, Screen, styles } from "../../components/Phase12UI";
import { getErrorMessage } from "../../utils/errorMessage";

export default function BookingConfirmScreen({ route, navigation }) {
  const details = route.params || {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const config = await configService.getPublicConfig();
      if (config["booking.enabled"] !== true || config["system.maintenanceMode"] === true) {
        setError("Booking is currently unavailable.");
        return;
      }
      const payload = {
        pickup: details.pickup,
        drop: details.drop,
        goods: details.goods,
        weight: details.weight,
        preferredPickupDate: details.preferredPickupDate,
        preferredPickupTime: details.preferredPickupTime,
        vehicleType: details.vehicleType
      };
      if (details.vehicleId) payload.vehicle = details.vehicleId;
      if (details.customerNote) payload.customerNote = details.customerNote;
      const booking = await bookingService.createBooking(payload);
      navigation.replace("BookingSuccess", { booking });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading title="Review your booking" subtitle="The backend calculates the authoritative fare." />
      <Card>
        <Text style={styles.cardTitle}>Route</Text>
        <Text style={styles.muted}>Pickup: {details.pickup?.address}</Text>
        <Text style={styles.muted}>Drop-off: {details.drop?.address}</Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Goods</Text>
        <Text style={styles.muted}>{details.goods}</Text>
        <Text style={styles.muted}>Weight: {details.weight?.value} {details.weight?.unit}</Text>
        <Text style={styles.muted}>Pickup: {details.preferredPickupDate} at {details.preferredPickupTime}</Text>
        {details.customerNote ? <Text style={styles.muted}>Note: {details.customerNote}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Vehicle</Text>
        <Text style={styles.muted}>{details.vehicle?.vehicleModel || "Driver assignment requested"}</Text>
        <Text style={styles.muted}>Type: {details.vehicleType?.replaceAll("-", " ")}</Text>
      </Card>
      <Notice message={error} />
      <Button title="Create booking" loading={busy} onPress={submit} />
    </Screen>
  );
}
