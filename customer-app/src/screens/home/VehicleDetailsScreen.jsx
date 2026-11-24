import React, { useEffect, useState } from "react";
import { Image, Text, View, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import vehicleService from "../../services/vehicleService";
import fareService from "../../services/fareService";
import configService from "../../services/configService";
import { Button, Card, Empty, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";
import { getOptimizedImageUrl } from "../../utils/imageOptimizer";
import EVBadge from "../../components/EVBadge";
import VehiclePhotoCarousel from "../../components/VehiclePhotoCarousel";
import {
  isEVVehicle,
  getVehicleCategoryLabel,
  formatVehicleCategory,
  canonicalizeServiceCategory,
  isPassengerCategory,
  SERVICE_CATEGORIES
} from "../../utils/vehicleDisplay";

export default function VehicleDetailsScreen({ route, navigation }) {
  const vehicleId = route.params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [config, setConfig] = useState({});
  const [fare, setFare] = useState(null);
  const [fareError, setFareError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      vehicleService.getVehicle(vehicleId),
      configService.getPublicConfig().catch(() => ({}))
    ])
      .then(([vehicleData, configData]) => {
        setVehicle(vehicleData);
        setConfig(configData || {});
      })
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

  const resolvedCategory = canonicalizeServiceCategory(vehicle?.serviceCategory || vehicle?.vehicleType);
  const isEV = isEVVehicle(vehicle);
  const isTaxi = resolvedCategory === SERVICE_CATEGORIES.TAXI || resolvedCategory === "GOODS_TAXI";
  const isCategoryDisabled =
    ((resolvedCategory === SERVICE_CATEGORIES.EV_PASSENGER || resolvedCategory === "EV_GOODS") && (config["service.ev_passenger.enabled"] ?? config["service.ev_goods.enabled"]) === false) ||
    ((resolvedCategory === SERVICE_CATEGORIES.TAXI || resolvedCategory === "GOODS_TAXI") && (config["service.taxi.enabled"] ?? config["service.goods_taxi.enabled"]) === false);

  return (
    <Screen>
      {error ? <Notice message={error} /> : null}

      {vehicle ? (
        <>
          {/* VEHICLE HEADER */}
          <View style={styles.headerContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitleText}>{vehicle.vehicleModel}</Text>
              <EVBadge vehicle={vehicle} />
            </View>
            <View style={styles.headerCategoryRow}>
              <View
                style={[
                  styles.catBadge,
                  isEV && styles.catBadgeEV,
                  isTaxi && styles.catBadgeTaxi
                ]}
              >
                <Text
                  style={[
                    styles.catBadgeText,
                    isEV && styles.catBadgeTextEV,
                    isTaxi && styles.catBadgeTextTaxi
                  ]}
                >
                  {getVehicleCategoryLabel(vehicle)}
                </Text>
              </View>
              <Text style={styles.headerSubText}>
                {formatVehicleCategory(vehicle.vehicleType)}
              </Text>
            </View>
          </View>

          {/* VEHICLE PHOTO CAROUSEL */}
          <VehiclePhotoCarousel
            vehicle={vehicle}
            height={220}
            autoPlayInterval={3500}
            overlayBadge={
              <EVBadge vehicle={vehicle} style={styles.imgBadgeOverlay} />
            }
          />

          {/* SPECIFICATIONS CARD */}
          <Card>
            <Text style={styles.cardHeaderTitle}>Vehicle Specifications</Text>

            <View style={styles.specRow}>
              <View style={styles.specLabelCol}>
                <Ionicons name="apps-outline" size={16} color={colors.primary} />
                <Text style={styles.specLabel}>Service Category</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.specValue}>{getVehicleCategoryLabel(vehicle)}</Text>
                <EVBadge vehicle={vehicle} size="small" />
              </View>
            </View>

            <View style={styles.specDivider} />

            {isEV || vehicle.fuelType ? (
              <>
                <View style={styles.specRow}>
                  <View style={styles.specLabelCol}>
                    <Ionicons name="flash-outline" size={16} color={isEV ? "#10B981" : colors.primary} />
                    <Text style={styles.specLabel}>Fuel Type</Text>
                  </View>
                  <Text style={[styles.specValue, isEV && { color: "#10B981", fontWeight: "700" }]}>
                    {isEV ? "Electric (Zero Emission)" : vehicle.fuelType}
                  </Text>
                </View>
                <View style={styles.specDivider} />
              </>
            ) : null}

            {isPassengerCategory(vehicle) ? (
              <View style={styles.specRow}>
                <View style={styles.specLabelCol}>
                  <Ionicons name="people-outline" size={16} color={colors.primary} />
                  <Text style={styles.specLabel}>Passenger Seating</Text>
                </View>
                <Text style={styles.specValue}>
                  {vehicle.seatingCapacity || 4} Passengers
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.specRow}>
                  <View style={styles.specLabelCol}>
                    <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                    <Text style={styles.specLabel}>Payload Capacity</Text>
                  </View>
                  <Text style={styles.specValue}>
                    {vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit || "kg"}
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
              </>
            )}

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
          {isCategoryDisabled ? (
            <Notice
              message="This transport service category is currently unavailable."
              tone="warning"
            />
          ) : null}
          <Button
            title={
              isCategoryDisabled
                ? "Service Category Unavailable"
                : vehicle.isAvailable
                  ? "Book This Vehicle"
                  : "Vehicle Currently Unavailable"
            }
            disabled={!vehicle.isAvailable || isCategoryDisabled}
            onPress={() =>
              navigation.navigate("BookingLocation", {
                vehicleType: vehicle.vehicleType,
                vehicleId: vehicle._id,
                serviceCategory: resolvedCategory
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
  headerContainer: {
    marginBottom: 12
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  headerTitleText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  headerCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  headerSubText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize"
  },
  catBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  catBadgeEV: {
    backgroundColor: "rgba(16, 185, 129, 0.15)"
  },
  catBadgeTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.15)"
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted
  },
  catBadgeTextEV: {
    color: "#059669"
  },
  catBadgeTextTaxi: {
    color: "#D97706"
  },
  imageWrap: {
    position: "relative",
    width: "100%",
    marginBottom: 12
  },
  imgBadgeOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10
  },
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
  imagePlaceholderEV: {
    backgroundColor: "rgba(16, 185, 129, 0.08)"
  },
  imagePlaceholderTaxi: {
    backgroundColor: "rgba(245, 158, 11, 0.08)"
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
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  specValue: {
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  fareNumber: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  fareNotice: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic"
  },
  fareFooterNote: {
    color: colors.textLight,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  }
});
