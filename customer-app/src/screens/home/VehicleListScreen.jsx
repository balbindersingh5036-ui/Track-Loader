import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import vehicleService from "../../services/vehicleService";
import { Button, Card, Empty, Field, Heading, Loading, Notice, Screen, styles, colors } from "../../components/Phase12UI";
import { getErrorMessage } from "../../utils/errorMessage";

const types = ["all", "mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"];

export default function VehicleListScreen({ navigation, route }) {
  const [vehicleType, setVehicleType] = useState(route.params?.vehicleType || "all");
  const [minCapacity, setMinCapacity] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (capacityFilters = {}) => {
    setLoading(true);
    setError("");
    try {
      const filters = {};
      if (vehicleType !== "all") filters.vehicleType = vehicleType;
      if (capacityFilters.minCapacity?.trim()) filters.minCapacity = capacityFilters.minCapacity.trim();
      if (capacityFilters.maxCapacity?.trim()) filters.maxCapacity = capacityFilters.maxCapacity.trim();
      const result = vehicleType !== "all" && !capacityFilters.minCapacity?.trim() && !capacityFilters.maxCapacity?.trim()
        ? await vehicleService.getVehiclesByType(vehicleType)
        : await vehicleService.getVehicles(filters);
      setVehicles(result);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [vehicleType]);

  useEffect(() => {
    setVehicleType(route.params?.vehicleType || "all");
  }, [route.params?.vehicleType]);
  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <Heading title="Available vehicles" subtitle="Vehicles and availability are fetched from LoadBalbin." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {types.map((type) => (
          <Pressable key={type} onPress={() => setVehicleType(type)} style={{ padding: 9, backgroundColor: vehicleType === type ? colors.primary : colors.white, borderRadius: 20 }}>
            <Text style={{ color: vehicleType === type ? colors.white : colors.ink, fontWeight: "600" }}>{type.replaceAll("-", " ")}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field style={{ flex: 1 }} label="Minimum capacity" value={minCapacity} onChangeText={setMinCapacity} keyboardType="decimal-pad" placeholder="e.g. 500" />
        <Field style={{ flex: 1 }} label="Maximum capacity" value={maxCapacity} onChangeText={setMaxCapacity} keyboardType="decimal-pad" placeholder="e.g. 5000" />
      </View>
      <Button title="Apply filters" secondary onPress={() => load({ minCapacity, maxCapacity })} />
      {error ? <Notice message={error} /> : null}
      {loading ? <Loading label="Loading available vehicles..." /> : vehicles.length ? vehicles.map((vehicle) => (
        <Pressable key={vehicle._id} onPress={() => navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })}>
          <Card>
            <Text style={styles.cardTitle}>{vehicle.vehicleModel}</Text>
            <Text style={styles.muted}>{vehicle.vehicleType.replaceAll("-", " ")} · {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}</Text>
            <Text style={styles.muted}>Body: {vehicle.bodyType || "Not specified"} · {vehicle.isAvailable ? "Available" : "Unavailable"}</Text>
            <Text style={styles.link}>View vehicle details</Text>
          </Card>
        </Pressable>
      )) : !error ? <Empty title="No vehicles found" detail="Try another vehicle type or capacity range." /> : null}
    </Screen>
  );
}
