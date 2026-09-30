import React, { useState } from "react";
import { MapView, Marker } from "react-native-maps";
import { Text, View } from "react-native";
import { Button, Field, Heading, Notice, Screen, styles, colors } from "../../components/Phase12UI";

const initialRegion = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 12,
  longitudeDelta: 12
};

export default function LocationScreen({ route, navigation }) {
  const [pickup, setPickup] = useState({ address: "", latitude: null, longitude: null });
  const [drop, setDrop] = useState({ address: "", latitude: null, longitude: null });
  const [mapTarget, setMapTarget] = useState("pickup");
  const [error, setError] = useState("");
  const selected = mapTarget === "pickup" ? pickup : drop;
  const markerCoordinate = Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)
    ? { latitude: selected.latitude, longitude: selected.longitude }
    : null;

  const handleMapPress = ({ nativeEvent }) => {
    const { latitude, longitude } = nativeEvent.coordinate;
    const update = (location) => ({
      ...location,
      latitude,
      longitude,
      address: location.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    });
    if (mapTarget === "pickup") setPickup(update);
    else setDrop(update);
  };

  const continueToGoods = () => {
    setError("");
    if (!pickup.address.trim() || !Number.isFinite(pickup.latitude) || !Number.isFinite(pickup.longitude)) {
      setError("Enter a pickup address and select its point on the map.");
      return;
    }
    if (!drop.address.trim() || !Number.isFinite(drop.latitude) || !Number.isFinite(drop.longitude)) {
      setError("Enter a drop-off address and select its point on the map.");
      return;
    }
    navigation.navigate("BookingGoods", {
      pickup,
      drop,
      vehicleType: route.params?.vehicleType,
      vehicleId: route.params?.vehicleId
    });
  };

  return (
    <Screen>
      <Heading title="Pickup and drop-off" subtitle="Enter the addresses, then tap the map to place each point. Location is not tracked in the background." />
      <Field label="Pickup address" value={pickup.address} onChangeText={(address) => setPickup((value) => ({ ...value, address }))} placeholder="Street, area, city" />
      <Field label="Drop-off address" value={drop.address} onChangeText={(address) => setDrop((value) => ({ ...value, address }))} placeholder="Street, area, city" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Select pickup on map" secondary style={{ flex: 1 }} onPress={() => setMapTarget("pickup")} />
        <Button title="Select drop on map" secondary style={{ flex: 1 }} onPress={() => setMapTarget("drop")} />
      </View>
      <Text style={styles.muted}>Tap map to set: {mapTarget === "pickup" ? "pickup" : "drop-off"}</Text>
      <MapView
        initialRegion={initialRegion}
        onPress={handleMapPress}
        style={{ height: 280, borderRadius: 14 }}
        accessibilityLabel="Tap to choose the selected delivery location"
      >
        {markerCoordinate ? <Marker coordinate={markerCoordinate} title={mapTarget === "pickup" ? "Pickup" : "Drop-off"} /> : null}
      </MapView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Text style={[styles.muted, { flex: 1 }]}>
          Pickup: {Number.isFinite(pickup.latitude) ? `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}` : "Choose on map"}
        </Text>
        <Text style={[styles.muted, { flex: 1 }]}>
          Drop: {Number.isFinite(drop.latitude) ? `${drop.latitude.toFixed(4)}, ${drop.longitude.toFixed(4)}` : "Choose on map"}
        </Text>
      </View>
      <Notice message={error} />
      <Button title="Continue" onPress={continueToGoods} />
    </Screen>
  );
}
