import React, { useEffect, useState } from "react";
import { Image, Text, View, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import fareService from "../../services/fareService";
import { Button, Card, Empty, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

export default function VehicleDetailsScreen({ route, navigation }) {
  const vehicleId = route.params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [fare, setFare] = useState(null);
  const [fareError, setFareError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vehicleService
      .getVehicle(vehicleId)
      .then(setVehicle)
      .catch((requestError) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicle?.vehicleType) return;
    fareService
      .getFare(vehicle.vehicleType)
      .then(setFare)
      .catch((requestError) => setFareError(getErrorMessage(requestError)));
  }, [vehicle?.vehicleType]);

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading vehicle details..." />
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Notice message={error} /> : null}

      {vehicle ? (
        <>
          {/* VEHICLE HEADER */}
          <Heading
            title={vehicle.vehicleModel}
            subtitle={vehicle.vehicleType?.replace(/-/g, " ")}
          />

          {/* MAIN HERO IMAGE */}
          {vehicle.vehicleImage ? (
            <Image
              source={{ uri: vehicle.vehicleImage }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons
                name="truck-outline"
                size={54}
                color={colors.mutedLight}
              />
            </View>
          )}

          {/* GALLERY IMAGES IF ANY */}
          {vehicle.vehicleImages && vehicle.vehicleImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {vehicle.vehicleImages.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={styles.galleryThumb}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : null}

          {/* SPECIFICATIONS CARD */}
          <Card>
            <Text style={styles.cardHeaderTitle}>Vehicle Specifications</Text>

            <View style={styles.specRow}>
              <View style={styles.specLabelCol}>
                <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                <Text style={styles.specLabel}>Load Capacity</Text>
              </View>
              <Text style={styles.specValue}>
                {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}
              </Text>
            </View>

            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <View style={styles.specLabelCol}>
                <Ionicons name="cube-outline" size={16} color={colors.primary} />
                <Text style={styles.specLabel}>Body Type</Text>
              </View>
              <Text style={styles.specValue}>{vehicle.bodyType || "Open body"}</Text>
            </View>

            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <View style={styles.specLabelCol}>
                <Ionicons name="card-outline" size={16} color={colors.primary} />
                <Text style={styles.specLabel}>Vehicle Reg Number</Text>
              </View>
              <Text style={styles.specValue}>{vehicle.vehicleNumber || "Verified"}</Text>
            </View>

            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <View style={styles.specLabelCol}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.specLabel}>Availability Status</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  vehicle.isAvailable ? styles.statusBadgeAvail : styles.statusBadgeBusy
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    vehicle.isAvailable ? styles.statusTextAvail : styles.statusTextBusy
                  ]}
                >
                  {vehicle.isAvailable ? "Available Now" : "Currently Assigned"}
                </Text>
              </View>
            </View>
          </Card>

          {/* FARE RATE CARD */}
          <Card>
            <Text style={styles.cardHeaderTitle}>Fare & Pricing Structure</Text>
            {fare ? (
              <View style={styles.fareGrid}>
                <View style={styles.fareBox}>
                  <Text style={styles.fareLabel}>Base Fare</Text>
                  <Text style={styles.fareNumber}>₹{fare.baseFare}</Text>
                </View>

                <View style={styles.fareBox}>
                  <Text style={styles.fareLabel}>Per KM Rate</Text>
                  <Text style={styles.fareNumber}>₹{fare.perKmRate}/km</Text>
                </View>

                <View style={styles.fareBox}>
                  <Text style={styles.fareLabel}>Per Ton Rate</Text>
                  <Text style={styles.fareNumber}>₹{fare.perTonRate || 0}/t</Text>
                </View>

                <View style={styles.fareBox}>
                  <Text style={styles.fareLabel}>Minimum Fare</Text>
                  <Text style={styles.fareNumber}>₹{fare.minimumFare || fare.baseFare}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.fareNotice}>
                {fareError || "Loading authoritative fare matrix..."}
              </Text>
            )}
            <Text style={styles.fareFooterNote}>
              * Total fare is calculated automatically by the server based on exact pickup, drop-off, and weight.
            </Text>
          </Card>

          {/* ACTION BUTTONS */}
          <Button
            title={vehicle.isAvailable ? "Book This Vehicle" : "Vehicle Currently Unavailable"}
            disabled={!vehicle.isAvailable}
            onPress={() =>
              navigation.navigate("BookingLocation", {
                vehicleType: vehicle.vehicleType,
                vehicleId: vehicle._id
              })
            }
          />
        </>
      ) : !error ? (
        <Empty title="Vehicle Not Found" detail="This vehicle may have been unlisted." />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt
  },
  imagePlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  gallery: {
    gap: 8,
    paddingVertical: 2
  },
  galleryThumb: {
    width: 100,
    height: 70,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt
  },
  cardHeaderTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  specLabelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  specLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500"
  },
  specValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  specDivider: {
    height: 1,
    backgroundColor: colors.lineLight
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  statusBadgeAvail: {
    backgroundColor: colors.successBg
  },
  statusBadgeBusy: {
    backgroundColor: colors.warningBg
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700"
  },
  statusTextAvail: {
    color: colors.successText
  },
  statusTextBusy: {
    color: colors.warningText
  },
  fareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4
  },
  fareBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    gap: 2
  },
  fareLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  fareNumber: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "800"
  },
  fareNotice: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic"
  },
  fareFooterNote: {
    color: colors.mutedLight,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  }
});
