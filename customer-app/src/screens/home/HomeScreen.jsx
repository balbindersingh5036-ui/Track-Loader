import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import bookingService from "../../services/bookingService";
import notificationService from "../../services/notificationService";
import configService from "../../services/configService";
import vehicleService from "../../services/vehicleService";
import { useAuth } from "../../store/AuthContext";
import { subscribeToBookingEvents, subscribeToNotifications } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, Status, styles, colors } from "../../components/Phase12UI";

const vehicleTypes = ["mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [config, setConfig] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [publicConfig, availableVehicles, bookings] = await Promise.all([
        configService.getPublicConfig(),
        vehicleService.getVehicles(),
        bookingService.getMyBookings({ limit: 100 })
      ]);
      setConfig(publicConfig);
      setVehicles(availableVehicles);
      setActiveBooking(bookings.bookings?.find((booking) =>
        ["pending", "accepted", "in-progress"].includes(booking.bookingStatus)
      ) || null);
      if (publicConfig["notification.enabled"] === false) {
        setUnreadCount(0);
      } else {
        setUnreadCount(await notificationService.getUnreadCount());
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribeBooking = subscribeToBookingEvents(() => load());
    const unsubscribeNotification = subscribeToNotifications(() => load());
    return () => {
      unsubscribeBooking();
      unsubscribeNotification();
    };
  }, [load]);

  if (loading) return <Screen><Loading label="Loading your dashboard..." /></Screen>;
  const isMaintenance = config["system.maintenanceMode"] === true;
  const availableTypes = vehicleTypes.filter((type) => vehicles.some((vehicle) => vehicle.vehicleType === type));

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Heading title={`Hello${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`} subtitle="Move goods with confidence." />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${unreadCount} unread notifications`}
          onPress={() => navigation.navigate("Notifications")}
          style={{ padding: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line }}
        >
          <Text style={{ color: colors.primary, fontWeight: "800" }}>Alerts {unreadCount ? `(${unreadCount})` : ""}</Text>
        </Pressable>
      </View>

      {isMaintenance ? <Notice message="Some services may be unavailable while the platform is under maintenance." tone="warning" /> : null}
      {config["booking.enabled"] !== true ? <Notice message="New bookings are temporarily unavailable." tone="warning" /> : null}
      {error ? <Notice message={error} /> : null}
      {error ? <Button title="Retry" secondary onPress={load} /> : null}

      <Card>
        <Text style={styles.cardTitle}>Book a goods transport</Text>
        <Text style={styles.muted}>Choose a vehicle type, add pickup and drop-off details, then review your request.</Text>
        <Button
          title="Browse available vehicles"
          disabled={isMaintenance || config["booking.enabled"] !== true}
          onPress={() => navigation.navigate("Vehicles")}
        />
      </Card>

      <View style={styles.row}>
        <Text style={styles.cardTitle}>Vehicle types</Text>
        <Pressable onPress={() => navigation.navigate("Vehicles")}><Text style={styles.link}>See all</Text></Pressable>
      </View>
      {availableTypes.length ? (
        <View style={{ gap: 8 }}>
          {availableTypes.map((type) => (
            <Pressable key={type} onPress={() => navigation.navigate("Vehicles", { vehicleType: type })}>
              <Card style={styles.row}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700" }}>{type.replaceAll("-", " ")}</Text>
                <Text style={styles.muted}>{vehicles.filter((vehicle) => vehicle.vehicleType === type).length} available</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : !error ? <Empty title="No vehicles available right now" detail="Please check again later." /> : null}

      <View style={styles.row}>
        <Text style={styles.cardTitle}>Available vehicles</Text>
        <Pressable onPress={() => navigation.navigate("Vehicles")}><Text style={styles.link}>View all</Text></Pressable>
      </View>
      {vehicles.slice(0, 3).map((vehicle) => (
        <Pressable key={vehicle._id} onPress={() => navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })}>
          <Card style={styles.row}>
            {vehicle.vehicleImage ? <Image source={{ uri: vehicle.vehicleImage }} style={{ width: 64, height: 52, borderRadius: 8 }} /> : null}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>{vehicle.vehicleModel}</Text>
              <Text style={styles.muted}>{vehicle.vehicleType.replaceAll("-", " ")} · {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}</Text>
            </View>
            <Text style={styles.link}>Details</Text>
          </Card>
        </Pressable>
      ))}

      <Text style={styles.cardTitle}>Your active booking</Text>
      {activeBooking ? (
        <Pressable onPress={() => navigation.navigate("BookingDetails", { bookingId: activeBooking._id })}>
          <Card>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{activeBooking.bookingId}</Text>
              <Status value={activeBooking.bookingStatus} />
            </View>
            <Text style={styles.muted}>{activeBooking.pickup?.address} → {activeBooking.drop?.address}</Text>
            <Text style={styles.link}>Open booking</Text>
          </Card>
        </Pressable>
      ) : <Empty title="No active bookings" detail="Your ongoing bookings will appear here." />}

      <Card>
        <Text style={styles.cardTitle}>Support</Text>
        <Text style={styles.muted}>Phone: {config["system.supportPhone"] || "Not provided"}</Text>
        <Text style={styles.muted}>Email: {config["system.supportEmail"] || "Not provided"}</Text>
      </Card>
    </Screen>
  );
}
