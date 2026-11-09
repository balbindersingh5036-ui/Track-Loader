import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";
import RouteMap from "../../components/RouteMap";
import routeService from "../../services/routeService";

export default function LocationScreen({ route, navigation }) {
  const bookingMode = route.params?.bookingMode || "instant";

  // Coordinates and addresses
  const [pickupAddress, setPickupAddress] = useState(route.params?.pickup?.address || "");
  const [pickupCoords, setPickupCoords] = useState({
    latitude: route.params?.pickup?.latitude || 26.8467, // Default Lucknow
    longitude: route.params?.pickup?.longitude || 80.9462
  });

  const [dropAddress, setDropAddress] = useState(route.params?.drop?.address || "");
  const [dropCoords, setDropCoords] = useState({
    latitude: route.params?.drop?.latitude || 28.6139, // Default Delhi
    longitude: route.params?.drop?.longitude || 77.2090
  });

  const [activePinMode, setActivePinMode] = useState("pickup"); // 'pickup' | 'drop'
  const [routeData, setRouteData] = useState(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");

  // Search state
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Search address handler
  const handleAddressSearch = (text, type) => {
    if (type === "pickup") {
      setPickupAddress(text);
    } else {
      setDropAddress(text);
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text || text.trim().length < 3) {
      if (type === "pickup") setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await routeService.searchAddress(text);
      if (type === "pickup") {
        setPickupSuggestions(results);
      } else {
        setDropSuggestions(results);
      }
    }, 400);
  };

  const selectSuggestion = (item, type) => {
    if (type === "pickup") {
      setPickupAddress(item.displayName);
      setPickupCoords({ latitude: item.latitude, longitude: item.longitude });
      setPickupSuggestions([]);
    } else {
      setDropAddress(item.displayName);
      setDropCoords({ latitude: item.latitude, longitude: item.longitude });
      setDropSuggestions([]);
    }
  };

  // Map click / pin handler
  const handleLocationSelect = async (mode, latitude, longitude) => {
    const lat = parseFloat(latitude.toFixed(6));
    const lon = parseFloat(longitude.toFixed(6));

    if (mode === "pickup") {
      setPickupCoords({ latitude: lat, longitude: lon });
      const addr = await routeService.reverseGeocode(lat, lon);
      if (addr) setPickupAddress(addr);
    } else {
      setDropCoords({ latitude: lat, longitude: lon });
      const addr = await routeService.reverseGeocode(lat, lon);
      if (addr) setDropAddress(addr);
    }
  };

  // Device Geolocation (foreground permission check + coordinate fetch)
  const useCurrentLocation = async () => {
    setGpsLoading(true);
    setError("");

    try {
      if (Location && typeof Location.requestForegroundPermissionsAsync === "function") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied. You can enter or select points manually on the map.");
          setGpsLoading(false);
          return;
        }

        let loc = await Location.getLastKnownPositionAsync();
        if (!loc) {
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }

        if (loc?.coords) {
          const lat = parseFloat(loc.coords.latitude.toFixed(6));
          const lon = parseFloat(loc.coords.longitude.toFixed(6));
          setPickupCoords({ latitude: lat, longitude: lon });
          const addr = await routeService.reverseGeocode(lat, lon);
          if (addr) setPickupAddress(addr);
          setGpsLoading(false);
          return;
        }
      }

      // Browser / Fallback Geolocation
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = parseFloat(pos.coords.latitude.toFixed(6));
            const lon = parseFloat(pos.coords.longitude.toFixed(6));
            setPickupCoords({ latitude: lat, longitude: lon });
            const addr = await routeService.reverseGeocode(lat, lon);
            if (addr) setPickupAddress(addr);
            setGpsLoading(false);
          },
          () => {
            setError("Location access denied or unavailable. You can enter or select points manually on the map.");
            setGpsLoading(false);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        setError("Geolocation is not supported on this device. Please select on the map.");
        setGpsLoading(false);
      }
    } catch (err) {
      setError("Unable to obtain GPS location. Please select points manually on the map.");
      setGpsLoading(false);
    }
  };

  // Fetch road route whenever coordinates change
  useEffect(() => {
    if (
      pickupCoords.latitude &&
      pickupCoords.longitude &&
      dropCoords.latitude &&
      dropCoords.longitude
    ) {
      let isMounted = true;
      setCalculatingRoute(true);

      routeService
        .calculateDistance(
          { ...pickupCoords, address: pickupAddress },
          { ...dropCoords, address: dropAddress },
          route.params?.vehicleType
        )
        .then((res) => {
          if (isMounted) {
            setRouteData(res);
            setCalculatingRoute(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setRouteData(null);
            setCalculatingRoute(false);
            setError(
              err?.response?.data?.message ||
              err?.message ||
              "Failed to calculate road route. Please verify addresses or coordinates."
            );
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [pickupCoords, dropCoords]);

  const continueToGoods = () => {
    setError("");
    if (!pickupAddress.trim()) {
      setError("Please enter the pickup location address.");
      return;
    }
    if (!dropAddress.trim()) {
      setError("Please enter the drop-off location address.");
      return;
    }
    if (calculatingRoute) {
      setError("Please wait while the road distance is being calculated.");
      return;
    }
    if (!routeData?.distanceKm || routeData.distanceKm <= 0) {
      setError("Unable to calculate road distance between the selected locations. Please check the locations and try again.");
      return;
    }

    const pickup = {
      address: pickupAddress.trim(),
      latitude: pickupCoords.latitude,
      longitude: pickupCoords.longitude
    };
    const drop = {
      address: dropAddress.trim(),
      latitude: dropCoords.latitude,
      longitude: dropCoords.longitude
    };

    navigation.navigate("BookingGoods", {
      ...route.params,
      bookingMode,
      pickup,
      drop,
      distanceKm: routeData.distanceKm,
      distanceMeters: routeData.distanceMeters,
      durationSeconds: routeData.durationSeconds,
      durationFormatted: routeData.durationFormatted,
      routeGeometry: routeData.geometry,
      routingProfile: routeData.routingProfile,
      vehicleType: route.params?.vehicleType,
      vehicleId: route.params?.vehicleId
    });
  };

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Heading
          title="Route Details"
          subtitle="Specify the pickup point and destination for your goods transport."
        />
        <View style={{
          backgroundColor: bookingMode === "instant" ? colors.surfaceAlt : (colors.primaryDark || "#0071AB"),
          borderWidth: 1,
          borderColor: bookingMode === "instant" ? colors.primary : (colors.primaryDark || "#0071AB"),
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8
        }}>
          <Text style={{
            color: bookingMode === "instant" ? colors.primary : colors.white,
            fontSize: 11,
            fontWeight: "800",
            textTransform: "uppercase"
          }}>
            {bookingMode === "instant" ? "Instant Mode" : "Scheduled Mode"}
          </Text>
        </View>
      </View>

      {/* STEP INDICATOR */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotActive]}>
          <Text style={styles.stepNumActive}>1</Text>
        </View>
        <Text style={styles.stepLabelActive}>Location</Text>
        <View style={styles.stepLine} />
        <View style={styles.stepDot}>
          <Text style={styles.stepNum}>2</Text>
        </View>
        <Text style={styles.stepLabel}>Goods</Text>
        <View style={styles.stepLine} />
        <View style={styles.stepDot}>
          <Text style={styles.stepNum}>3</Text>
        </View>
        <Text style={styles.stepLabel}>Vehicle</Text>
      </View>

      {/* MAP VIEW */}
      <RouteMap
        pickup={pickupCoords}
        drop={dropCoords}
        routeCoordinates={routeData?.coordinates || []}
        activeSelectionMode={activePinMode}
        onLocationSelect={handleLocationSelect}
        distanceKm={routeData?.distanceKm}
        durationFormatted={routeData?.durationFormatted}
        height={240}
      />

      {/* MAP CONTROLS & DISTANCE STATS */}
      <View style={styles.mapControlsRow}>
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={[styles.modeTab, activePinMode === "pickup" && styles.modeTabActivePickup]}
            onPress={() => setActivePinMode("pickup")}
          >
            <Ionicons name="radio-button-on" size={14} color={activePinMode === "pickup" ? "#fff" : colors.primary} />
            <Text style={[styles.modeTabText, activePinMode === "pickup" && styles.modeTabTextActive]}>
              Tap to set Pickup
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activePinMode === "drop" && styles.modeTabActiveDrop]}
            onPress={() => setActivePinMode("drop")}
          >
            <Ionicons name="location" size={14} color={activePinMode === "drop" ? "#fff" : colors.danger} />
            <Text style={[styles.modeTabText, activePinMode === "drop" && styles.modeTabTextActive]}>
              Tap to set Drop
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.gpsButton}
          onPress={useCurrentLocation}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate" size={14} color={colors.primary} />
          )}
          <Text style={styles.gpsButtonText}>
            {gpsLoading ? "Locating..." : "My Location"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ROUTE SUMMARY INFO */}
      {routeData && (
        <View style={styles.routeStatsBox}>
          <View style={styles.routeStatItem}>
            <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
            <Text style={styles.routeStatText}>
              Road Distance: <Text style={styles.boldText}>{routeData.distanceKm} km</Text>
            </Text>
          </View>
          <View style={styles.routeStatItem}>
            <Ionicons name="time-outline" size={16} color="#059669" />
            <Text style={styles.routeStatText}>
              Est. Driving: <Text style={styles.boldText}>{routeData.durationFormatted}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* ADDRESS INPUT CARDS */}
      <Card>
        <View style={styles.inputGroup}>
          <View style={styles.fieldHeader}>
            <View style={styles.iconCirclePickup}>
              <Ionicons name="radio-button-on" size={16} color={colors.primary} />
            </View>
            <Text style={styles.fieldLabel}>Pickup Location</Text>
          </View>
          <Field
            value={pickupAddress}
            onChangeText={(txt) => handleAddressSearch(txt, "pickup")}
            placeholder="Search pickup address or tap on map..."
            multiline
          />
          {pickupSuggestions.length > 0 && (
            <View style={styles.suggestionsList}>
              {pickupSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionItem}
                  onPress={() => selectSuggestion(item, "pickup")}
                >
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.routeConnector}>
          <View style={styles.dashedLine} />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.fieldHeader}>
            <View style={styles.iconCircleDrop}>
              <Ionicons name="location" size={16} color={colors.danger} />
            </View>
            <Text style={styles.fieldLabel}>Drop-Off Location</Text>
          </View>
          <Field
            value={dropAddress}
            onChangeText={(txt) => handleAddressSearch(txt, "drop")}
            placeholder="Search drop destination or tap on map..."
            multiline
          />
          {dropSuggestions.length > 0 && (
            <View style={styles.suggestionsList}>
              {dropSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionItem}
                  onPress={() => selectSuggestion(item, "drop")}
                >
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Card>

      <Notice message={error} />

      <Button
        title={calculatingRoute ? "Calculating Road Route..." : "Continue to Goods Details"}
        icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
        iconPosition="right"
        disabled={calculatingRoute}
        onPress={continueToGoods}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 4
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotActive: {
    backgroundColor: colors.primary
  },
  stepNum: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted
  },
  stepNumActive: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted
  },
  stepLabelActive: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.line,
    marginHorizontal: 8
  },
  mapControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  modeToggleGroup: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden"
  },
  modeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modeTabActivePickup: {
    backgroundColor: "#16a34a"
  },
  modeTabActiveDrop: {
    backgroundColor: "#dc2626"
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  modeTabTextActive: {
    color: "#ffffff"
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary
  },
  routeStatsBox: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line
  },
  routeStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  routeStatText: {
    fontSize: 13,
    color: colors.text
  },
  boldText: {
    fontWeight: "700"
  },
  inputGroup: {
    marginBottom: 4
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  iconCirclePickup: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCircleDrop: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.dangerBg || "#fee2e2",
    alignItems: "center",
    justifyContent: "center"
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  routeConnector: {
    paddingLeft: 11,
    paddingVertical: 2
  },
  dashedLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.line
  },
  suggestionsList: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 4,
    overflow: "hidden"
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  suggestionText: {
    fontSize: 12,
    color: colors.text,
    flex: 1
  }
});
