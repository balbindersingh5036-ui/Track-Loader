import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import bookingService from "../../services/bookingService";
import notificationService from "../../services/notificationService";
import configService from "../../services/configService";
import vehicleService from "../../services/vehicleService";
import { useAuth } from "../../store/AuthContext";
import { subscribeToBookingEvents, subscribeToNotifications } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Card, Loading, Notice, Status } from "../../components/Phase12UI";
import LoadBalbinLogo from "../../components/LoadBalbinLogo";
import { colors, shadows } from "../../theme/theme";

const vehicleTypes = ["mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"];
const { width } = Dimensions.get("window");

const getVehicleIcon = (type) => {
  switch (type) {
    case "mini-truck":
      return "truck-fast-outline";
    case "pickup":
      return "truck-outline";
    case "small-truck":
      return "truck-cargo-container";
    case "medium-truck":
      return "truck-flatbed";
    case "large-truck":
      return "truck-trailer";
    default:
      return "truck-outline";
  }
};

const getVehicleTypeDescription = (type) => {
  switch (type) {
    case "mini-truck":
      return "For small to medium goods";
    case "pickup":
      return "For quick, light deliveries";
    case "small-truck":
      return "For intra-city transport";
    case "medium-truck":
      return "For regional logistics";
    case "large-truck":
      return "For heavy freight";
    default:
      return "Standard transport";
  }
};

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
      setActiveBooking(
        bookings.bookings?.find((booking) =>
          ["pending", "accepted", "in-progress"].includes(booking.bookingStatus)
        ) || null
      );
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  const isMaintenance = config["system.maintenanceMode"] === true;
  const isBookingDisabled = config["booking.enabled"] !== true;
  const availableTypes = vehicleTypes.filter((type) =>
    vehicles.some((vehicle) => vehicle.vehicleType === type)
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* HEADER BAR */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <LoadBalbinLogo />
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => navigation.navigate("Notifications")}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* GREETING SECTION */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>
            Hello, {user?.name || "Customer"} 👋
          </Text>
          <Text style={styles.greetingSubtitle}>Move goods with confidence.</Text>
        </View>

        {/* SYSTEM STATUS ALERTS */}
        {isMaintenance ? (
          <Notice
            message="System is currently in maintenance mode. Some features may be limited."
            tone="warning"
          />
        ) : null}

        {isBookingDisabled && !isMaintenance ? (
          <Notice
            message="New transport bookings are currently paused by the administrator."
            tone="info"
          />
        ) : null}

        {error ? <Notice message={error} /> : null}

        {/* HERO ACTION / BOOKING CARD */}
        <View style={[styles.heroCard, shadows.card]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBox}>
              <Ionicons name="cube-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Find the right truck for your load.</Text>
              <Text style={styles.heroSubtitle}>
                Book reliable goods transport for every delivery.
              </Text>
            </View>
          </View>

          <View style={styles.heroButtonRow}>
            <Pressable
              style={[
                styles.primaryCta,
                isBookingDisabled && styles.btnDisabled
              ]}
              disabled={isBookingDisabled}
              onPress={() => navigation.navigate("BookingLocation")}
            >
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.primaryCtaText}>Find a Truck</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryCta}
              onPress={() => navigation.navigate("VehicleList")}
            >
              <Text style={styles.secondaryCtaText}>Book a Transport</Text>
            </Pressable>
          </View>
        </View>

        {/* ACTIVE BOOKING CARD (IF EXISTS) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Booking</Text>
          {activeBooking ? (
            <Pressable onPress={() => navigation.navigate("Bookings")}>
              <Text style={styles.sectionLink}>View all</Text>
            </Pressable>
          ) : null}
        </View>

        {activeBooking ? (
          <Pressable
            style={[styles.activeBookingCard, shadows.soft]}
            onPress={() =>
              navigation.navigate("BookingDetails", { bookingId: activeBooking._id })
            }
          >
            <View style={styles.activeBookingTop}>
              <View>
                <Text style={styles.activeBookingId}>{activeBooking.bookingId}</Text>
                <Text style={styles.activeBookingVehicle}>
                  {activeBooking.vehicle?.vehicleModel ||
                    activeBooking.vehicleType?.replaceAll("-", " ")}
                </Text>
              </View>
              <Status value={activeBooking.bookingStatus} />
            </View>

            <View style={styles.activeBookingRoute}>
              <View style={styles.routeRow}>
                <Ionicons name="radio-button-on" size={14} color={colors.primary} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {activeBooking.pickup?.address || "Pickup Location"}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <Ionicons name="location" size={14} color={colors.danger} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {activeBooking.drop?.address || "Drop Location"}
                </Text>
              </View>
            </View>

            <View style={styles.activeBookingBottom}>
              <Text style={styles.activeBookingFare}>
                Fare: ₹{activeBooking.estimatedFare}
              </Text>
              <View style={styles.viewDetailsRow}>
                <Text style={styles.viewDetailsText}>Track Details</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyActiveBooking}>
            <Ionicons name="clipboard-outline" size={24} color={colors.textLight} />
            <Text style={styles.emptyActiveText}>No active bookings at the moment</Text>
          </View>
        )}

        {/* VEHICLE TYPES CATEGORY SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vehicle Types</Text>
          <Pressable onPress={() => navigation.navigate("VehicleType")}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeScroll}
        >
          {vehicleTypes.map((type) => {
            const count = vehicles.filter((v) => v.vehicleType === type && v.isAvailable).length;
            const iconName = getVehicleIcon(type);
            const typeLabel = type.replace(/-/g, " ");

            return (
              <Pressable
                key={type}
                style={[styles.typeCard, shadows.soft]}
                onPress={() => navigation.navigate("VehicleList", { vehicleType: type })}
              >
                <View style={styles.typeIconBox}>
                  <MaterialCommunityIcons name={iconName} size={28} color={colors.primary} />
                </View>
                <Text style={styles.typeCardName}>{typeLabel}</Text>
                <Text style={styles.typeCardDesc} numberOfLines={2}>
                  {getVehicleTypeDescription(type)}
                </Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {count} {count === 1 ? "available" : "available"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* AVAILABLE VEHICLES SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Trucks</Text>
          <Pressable onPress={() => navigation.navigate("VehicleList")}>
            <Text style={styles.sectionLink}>View all ({vehicles.length})</Text>
          </Pressable>
        </View>

        {vehicles.length === 0 ? (
          <View style={styles.emptyVehiclesBox}>
            <MaterialCommunityIcons name="truck-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyVehiclesTitle}>No trucks available</Text>
            <Text style={styles.emptyVehiclesDesc}>
              Check back soon for available transport vehicles.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 16 }}>
            {vehicles.slice(0, 5).map((vehicle) => (
              <Pressable
                key={vehicle._id}
                style={[{ width: 260, backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.line }, shadows.soft]}
                onPress={() => navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })}
              >
                {vehicle.vehicleImage ? (
                  <Image source={{ uri: vehicle.vehicleImage }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: "100%", height: 160, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={getVehicleIcon(vehicle.vehicleType)} size={48} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ padding: 16, gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>{vehicle.vehicleModel}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, textTransform: "capitalize" }}>{vehicle.vehicleType?.replace(/-/g, " ")}</Text>
                  
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="speedometer-outline" size={14} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}</Text>
                    </View>
                    <Text style={{ color: colors.textHighlight, fontSize: 14, fontWeight: "700" }}>₹{vehicle.baseFare || "Est."}</Text>
                  </View>
                  
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <View style={{ backgroundColor: vehicle.isAvailable ? colors.secondary : colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                      <Text style={{ color: vehicle.isAvailable ? colors.background : colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
                        {vehicle.isAvailable ? "Available" : "Busy"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>View Details</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* SUPPORT / HELP BANNER */}
        <View style={[styles.supportBanner, shadows.soft]}>
          <View style={styles.supportIconBox}>
            <Ionicons name="headset-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>Need Help with Transport?</Text>
            <Text style={styles.supportDesc}>
              Contact support or submit a service inquiry.
            </Text>
          </View>
          <Pressable
            style={styles.supportBtn}
            onPress={() => navigation.navigate("Support")}
          >
            <Text style={styles.supportBtnText}>Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 65,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  brandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  brandTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  brandTagline: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: -1
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  unreadBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  unreadCount: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140, // Increased to clear bottom navigation completely
    gap: 18
  },
  greetingSection: {
    gap: 2
  },
  greetingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  greetingSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 16
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  heroTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  heroButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  primaryCta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#08A9F5",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
    minHeight: 50
  },
  primaryCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryCta: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt, // Secondary surface
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    minHeight: 50
  },
  secondaryCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.6
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  activeBookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12
  },
  activeBookingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  activeBookingId: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  activeBookingVehicle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize",
    marginTop: 1
  },
  activeBookingRoute: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 4
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  routeLine: {
    width: 1,
    height: 10,
    backgroundColor: colors.line,
    marginLeft: 6,
    marginVertical: 1
  },
  routeText: {
    flex: 1,
    color: colors.textLight,
    fontSize: 13,
    fontWeight: "500"
  },
  activeBookingBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10
  },
  activeBookingFare: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  viewDetailsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  emptyActiveBooking: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  emptyActiveText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  typeScroll: {
    gap: 12,
    paddingRight: 8
  },
  typeCard: {
    width: 148,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 6
  },
  typeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  typeCardName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  typeCardDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    minHeight: 30
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginTop: 4
  },
  typeBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700"
  },
  vehicleGrid: {
    gap: 12
  },
  vehicleItemCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden"
  },
  vehicleImg: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceAlt
  },
  vehiclePlaceholderImg: {
    width: "100%",
    height: 100,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  vehicleInfo: {
    padding: 14,
    gap: 6
  },
  vehicleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  vehicleModel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  availPill: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7
  },
  availYes: {
    backgroundColor: colors.successBg
  },
  availNo: {
    backgroundColor: colors.warningBg
  },
  availText: {
    fontSize: 10,
    fontWeight: "800"
  },
  availTextYes: {
    color: colors.successText
  },
  availTextNo: {
    color: colors.warningText
  },
  vehicleTypeTag: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize"
  },
  vehicleSpecsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 4
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  specText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500"
  },
  vehicleCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    paddingTop: 10,
    marginTop: 4
  },
  viewSpecsLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  emptyVehiclesBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 24,
    gap: 8
  },
  emptyVehiclesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  emptyVehiclesDesc: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center"
  },
  supportBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12
  },
  supportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  supportTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  supportDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  supportBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  supportBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  }
});
