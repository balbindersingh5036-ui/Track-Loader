import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View, ScrollView, RefreshControl, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import bookingService from "../../services/bookingService";
import notificationService from "../../services/notificationService";
import configService from "../../services/configService";
import vehicleService from "../../services/vehicleService";
import { useAuth } from "../../store/AuthContext";
import { subscribeToBookingEvents, subscribeToNotifications } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Loading, colors } from "../../components/Phase12UI";

const vehicleTypes = ["mini-truck", "pickup", "small-truck", "medium-truck", "large-truck"];
const { width } = Dimensions.get('window');

const getVehicleIcon = (type) => {
  switch (type) {
    case 'mini-truck': return 'truck-fast-outline';
    case 'pickup': return 'truck-outline';
    case 'small-truck': return 'truck-cargo-container';
    case 'medium-truck': return 'truck-flatbed';
    case 'large-truck': return 'truck-trailer';
    default: return 'truck-outline';
  }
};

const getVehicleTypeDescription = (type) => {
  switch (type) {
    case 'mini-truck': return 'For small to medium goods';
    case 'pickup': return 'For quick, light deliveries';
    case 'small-truck': return 'For intra-city transport';
    case 'medium-truck': return 'For regional logistics';
    case 'large-truck': return 'For heavy freight';
    default: return 'Standard transport';
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading your dashboard..." />
      </SafeAreaView>
    );
  }

  const isMaintenance = config["system.maintenanceMode"] === true;
  const isBookingDisabled = config["booking.enabled"] !== true;
  const availableTypes = vehicleTypes.filter((type) => vehicles.some((vehicle) => vehicle.vehicleType === type));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandContainer}>
            <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary} />
            <Text style={styles.brandName}>LoadBalbin</Text>
          </View>
          <Pressable 
            style={styles.notificationBtn}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Feather name="bell" size={22} color={colors.ink} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>Hello, {user?.name ? user.name.split(" ")[0] : "Customer"}</Text>
          <Text style={styles.greetingSubtitle}>Move goods with confidence.</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* ALERTS */}
        {isMaintenance && (
          <View style={[styles.alertBanner, { backgroundColor: '#FFF4D6' }]}>
            <Feather name="info" size={20} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]}>Platform is under maintenance.</Text>
          </View>
        )}
        {isBookingDisabled && !isMaintenance && (
          <View style={[styles.alertBanner, { backgroundColor: '#FFF4D6' }]}>
            <Feather name="info" size={20} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]}>New bookings are temporarily unavailable.</Text>
          </View>
        )}
        {error ? (
          <View style={[styles.alertBanner, { backgroundColor: '#FDECEA' }]}>
            <Feather name="alert-triangle" size={20} color={colors.danger} />
            <Text style={[styles.alertText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* BOOKING CTA CARD */}
        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Book a goods transport</Text>
          <Text style={styles.ctaDescription}>Choose a vehicle type, add pickup and drop-off details, then review your request.</Text>
          <Pressable 
            style={({ pressed }) => [styles.ctaButton, (isMaintenance || isBookingDisabled) && styles.disabled, pressed && styles.pressed]}
            disabled={isMaintenance || isBookingDisabled}
            onPress={() => navigation.navigate("Vehicles")}
          >
            <View style={styles.ctaButtonContent}>
              <Feather name="truck" size={18} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.ctaButtonText}>Browse available vehicles</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.white} />
          </Pressable>
        </View>

        {/* VEHICLE TYPES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vehicle types</Text>
          <Pressable onPress={() => navigation.navigate("Vehicles")}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>
        
        {availableTypes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {availableTypes.map((type) => {
              const count = vehicles.filter((v) => v.vehicleType === type).length;
              return (
                <Pressable 
                  key={type} 
                  style={styles.typeCard}
                  onPress={() => navigation.navigate("Vehicles", { vehicleType: type })}
                >
                  <View style={styles.typeIconContainer}>
                    <MaterialCommunityIcons name={getVehicleIcon(type)} size={28} color={colors.primary} />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={styles.typeName}>{type.replace('-', ' ')}</Text>
                    <Text style={styles.typeDesc}>{getVehicleTypeDescription(type)}</Text>
                    <View style={styles.availabilityChip}>
                      <View style={styles.dot} />
                      <Text style={styles.availabilityText}>{count} available</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          !error && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="truck-off-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyTitle}>No vehicles available</Text>
              <Text style={styles.emptyDetail}>Please check again later.</Text>
            </View>
          )
        )}

        {/* AVAILABLE VEHICLES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available vehicles</Text>
          <Pressable onPress={() => navigation.navigate("Vehicles")}>
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
        </View>
        
        <View style={styles.vehicleList}>
          {vehicles.slice(0, 3).map((vehicle) => (
            <Pressable 
              key={vehicle._id} 
              style={styles.vehicleCard}
              onPress={() => navigation.navigate("VehicleDetails", { vehicleId: vehicle._id })}
            >
              <View style={styles.vehicleRow}>
                {vehicle.vehicleImage ? (
                  <Image source={{ uri: vehicle.vehicleImage }} style={styles.vehicleImage} />
                ) : (
                  <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
                    <MaterialCommunityIcons name="truck-outline" size={24} color={colors.muted} />
                  </View>
                )}
                <View style={styles.vehicleDetails}>
                  <Text style={styles.vehicleModel}>{vehicle.vehicleModel}</Text>
                  <Text style={styles.vehicleType}>{vehicle.vehicleType.replace('-', ' ')}</Text>
                  <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{vehicle.loadCapacity?.value} {vehicle.loadCapacity?.unit}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{vehicle.bodyType}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.vehicleAction}>
                <Text style={styles.vehicleActionText}>Details</Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </View>
            </Pressable>
          ))}
        </View>

        {/* ACTIVE BOOKING */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your active booking</Text>
        </View>
        
        {activeBooking ? (
          <Pressable 
            style={styles.bookingCard}
            onPress={() => navigation.navigate("BookingDetails", { bookingId: activeBooking._id })}
          >
            <View style={styles.bookingHeader}>
              <Text style={styles.bookingId}>{activeBooking.bookingId}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{activeBooking.bookingStatus.toUpperCase()}</Text>
              </View>
            </View>
            
            <View style={styles.locationContainer}>
              <View style={styles.locationTrack}>
                <View style={styles.dotStart} />
                <View style={styles.trackLine} />
                <View style={styles.dotEnd} />
              </View>
              <View style={styles.locationDetails}>
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Pickup</Text>
                  <Text style={styles.locationText} numberOfLines={1}>{activeBooking.pickup?.address}</Text>
                </View>
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Drop-off</Text>
                  <Text style={styles.locationText} numberOfLines={1}>{activeBooking.drop?.address}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.bookingFooter}>
              <Text style={styles.openBookingText}>Open booking</Text>
              <Feather name="arrow-right" size={16} color={colors.primary} />
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyBooking}>
            <View style={styles.emptyIconCircle}>
              <Feather name="file-text" size={24} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No active bookings</Text>
            <Text style={styles.emptyDetail}>Your ongoing bookings will appear here.</Text>
          </View>
        )}

        {/* SUPPORT */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Support</Text>
        </View>
        
        <Pressable style={styles.supportCard} onPress={() => navigation.navigate("Settings")}>
          <View style={styles.supportIconContainer}>
            <Feather name="headphones" size={22} color={colors.primary} />
          </View>
          <View style={styles.supportInfo}>
            <Text style={styles.supportTitle}>Need help?</Text>
            <Text style={styles.supportDesc}>Contact our support team for any assistance.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.muted} />
        </Pressable>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: colors.canvas,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.canvas,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  greetingContainer: {
    gap: 4,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 16,
    color: colors.muted,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 24,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  ctaCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  ctaDescription: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  ctaButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: -8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  horizontalScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  typeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    width: width * 0.45,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F7F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeInfo: {
    gap: 4,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize',
  },
  typeDesc: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
  },
  availabilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  availabilityText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginTop: 12,
  },
  emptyDetail: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  vehicleList: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  vehicleImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  vehicleImagePlaceholder: {
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  vehicleDetails: {
    flex: 1,
    gap: 4,
  },
  vehicleModel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  vehicleType: {
    fontSize: 14,
    color: colors.muted,
    textTransform: 'capitalize',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F4F7F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'capitalize',
  },
  vehicleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F3',
    paddingTop: 12,
  },
  vehicleActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  bookingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bookingId: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  statusBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  locationTrack: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  dotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  trackLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8E6',
    marginVertical: 4,
  },
  dotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginBottom: 4,
  },
  locationDetails: {
    flex: 1,
    gap: 16,
  },
  locationRow: {
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F3',
    paddingTop: 12,
  },
  openBookingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyBooking: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  supportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: {
    flex: 1,
    gap: 4,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  supportDesc: {
    fontSize: 13,
    color: colors.muted,
  }
});
