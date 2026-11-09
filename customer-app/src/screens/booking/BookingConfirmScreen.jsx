import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import configService from "../../services/configService";
import bookingService from "../../services/bookingService";
import { Button, Card, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";
import { getErrorMessage } from "../../utils/errorMessage";

export default function BookingConfirmScreen({ route, navigation }) {
  const details = route.params || {};
  const bookingMode = details.bookingMode || "instant";
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fareEstimate, setFareEstimate] = useState(null);

  React.useEffect(() => {
    if (details.vehicleType) {
      import("../../services/fareService").then(({ default: fareService }) => {
        fareService.getFare(details.vehicleType)
          .then((fare) => setFareEstimate(fare))
          .catch(() => {});
      });
    }
  }, [details.vehicleType]);

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      try {
        const config = await configService.getPublicConfig();
        if (config["booking.enabled"] === false || config["system.maintenanceMode"] === true) {
          setError(
            config["system.maintenanceMode"] === true
              ? "System is currently undergoing maintenance. Please try again later."
              : "Booking service is currently disabled. Please try again later."
          );
          setBusy(false);
          return;
        }
      } catch (cfgErr) {
        // Non-blocking: let backend server enforce authoritative availability
      }

      const isInstant = bookingMode === "instant";
      const now = new Date();
      const todayDate = now.toISOString().split("T")[0];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const payload = {
        pickup: details.pickup,
        drop: details.drop,
        goods: details.goods,
        weight: details.weight,
        preferredPickupDate: isInstant ? todayDate : details.preferredPickupDate,
        preferredPickupTime: isInstant ? currentTime : details.preferredPickupTime,
        vehicleType: details.vehicleType,
        bookingMode,
        paymentMethod
      };
      if (details.vehicleId) payload.vehicle = details.vehicleId;
      if (!details.vehicleId && details.agencyId) payload.agencyId = details.agencyId;
      if (details.customerNote) payload.customerNote = details.customerNote;

      const booking = await bookingService.createBooking(payload);
      navigation.replace("BookingSuccess", {
        booking,
        alternativeAssigned: booking.alternativeAssigned,
        serverMessage: booking.serverMessage
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const distanceKm = Number(details.distanceKm) || 0;
  const weightVal = Number(details.weight?.value) || 0;
  const weightInTon = details.weight?.unit === "ton" ? weightVal : weightVal / 1000;
  const distanceCharge = distanceKm * (fareEstimate?.perKmRate || 0);
  const weightCharge = weightInTon * (fareEstimate?.perTonRate || 0);
  const calculatedFare = distanceCharge + weightCharge;
  const estimatedTotal = fareEstimate
    ? Math.max(calculatedFare, fareEstimate.minimumFare || 0)
    : null;

  return (
    <Screen>
      <Heading
        title="Review Your Booking"
        subtitle="Confirm all transportation details before submitting your request."
      />

      {/* ROUTE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Route Information</Text>
          <Ionicons name="map-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Ionicons name="radio-button-on" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeRoleLabel}>Pickup Location</Text>
              <Text style={styles.routeAddressText}>{details.pickup?.address}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeItem}>
            <Ionicons name="location" size={14} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeRoleLabel}>Drop-Off Location</Text>
              <Text style={styles.routeAddressText}>{details.drop?.address}</Text>
            </View>
          </View>

          {details.distanceKm != null && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="navigate-circle-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                  Road Distance: {details.distanceKm} km
                </Text>
              </View>
              {details.durationFormatted ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Est: {details.durationFormatted}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </Card>

      {/* GOODS & SCHEDULE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Cargo & Schedule</Text>
          <Ionicons name="cube-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Cargo</Text>
            <Text style={styles.gridValue}>{details.goods}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Weight</Text>
            <Text style={styles.gridValue}>
              {details.weight?.value} {details.weight?.unit}
            </Text>
          </View>
        </View>

        {bookingMode === "instant" ? (
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Pickup Schedule</Text>
              <Text style={[styles.gridValue, { color: colors.primary }]}>Immediate Dispatch (Now)</Text>
            </View>
          </View>
        ) : (
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Pickup Date</Text>
              <Text style={styles.gridValue}>{details.preferredPickupDate}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Pickup Time</Text>
              <Text style={styles.gridValue}>{details.preferredPickupTime}</Text>
            </View>
          </View>
        )}

        {details.customerNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Driver Note:</Text>
            <Text style={styles.noteText}>{details.customerNote}</Text>
          </View>
        ) : null}
      </Card>

      {/* VEHICLE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Vehicle Assignment</Text>
          <MaterialCommunityIcons name="truck-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIconBadge}>
            <MaterialCommunityIcons name="truck-fast" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleTitle}>
              {details.vehicle?.vehicleModel || "Automatic Driver Assignment"}
            </Text>
            <Text style={styles.vehicleSubtitle}>
              Category: {details.vehicleType?.replace(/-/g, " ")}
            </Text>
          </View>
        </View>
      </Card>

      {/* FARE & BOOKING MODE CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Fare & Booking Summary</Text>
          <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Booking Mode</Text>
            <Text style={[styles.gridValue, { color: colors.primary, textTransform: "uppercase" }]}>
              {bookingMode}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Estimated Total</Text>
            <Text style={[styles.gridValue, { color: colors.primaryDark || "#0071AB", fontWeight: "800" }]}>
              {estimatedTotal != null ? `₹${estimatedTotal.toFixed(2)}` : "Calculating..."}
            </Text>
          </View>
        </View>

        {fareEstimate ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Road Pricing Breakdown:</Text>
            <Text style={styles.noteText}>
              • Distance: {distanceKm} km × ₹{fareEstimate.perKmRate}/km = ₹{distanceCharge.toFixed(2)}
            </Text>
            <Text style={styles.noteText}>
              • Cargo Weight: {weightInTon.toFixed(2)} ton × ₹{fareEstimate.perTonRate || 0}/ton = ₹{weightCharge.toFixed(2)}
            </Text>
            <Text style={styles.noteText}>
              • Minimum Fare: ₹{fareEstimate.minimumFare} (Applied if calculated total is less)
            </Text>
          </View>
        ) : null}
      </Card>

      {/* PAYMENT METHOD SELECTION CARD */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeaderTitle}>Payment Method</Text>
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        </View>

        <View style={styles.paymentOptionList}>
          {/* COD OPTION */}
          <Pressable
            style={[
              styles.paymentOptionCard,
              paymentMethod === "COD" && styles.paymentOptionCardActive
            ]}
            onPress={() => setPaymentMethod("COD")}
            accessibilityRole="radio"
            accessibilityState={{ selected: paymentMethod === "COD" }}
          >
            <View style={styles.paymentRadioRow}>
              <View style={[styles.radioDot, paymentMethod === "COD" && styles.radioDotActive]}>
                {paymentMethod === "COD" ? <View style={styles.radioDotInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.paymentOptionTitle}>Cash on Delivery (COD)</Text>
                  <View style={styles.badgeSuccess}>
                    <Text style={styles.badgeSuccessText}>Cash</Text>
                  </View>
                </View>
                <Text style={styles.paymentOptionDesc}>
                  Pay the driver in cash according to the booking payment terms.
                </Text>
              </View>
              <MaterialCommunityIcons name="cash-multiple" size={24} color={paymentMethod === "COD" ? colors.primary : colors.textMuted} />
            </View>
          </Pressable>

          {/* ONLINE OPTION */}
          <Pressable
            style={[
              styles.paymentOptionCard,
              paymentMethod === "ONLINE" && styles.paymentOptionCardActive
            ]}
            onPress={() => setPaymentMethod("ONLINE")}
            accessibilityRole="radio"
            accessibilityState={{ selected: paymentMethod === "ONLINE" }}
          >
            <View style={styles.paymentRadioRow}>
              <View style={[styles.radioDot, paymentMethod === "ONLINE" && styles.radioDotActive]}>
                {paymentMethod === "ONLINE" ? <View style={styles.radioDotInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.paymentOptionTitle}>Pay Online (Razorpay)</Text>
                  <View style={styles.badgeInfo}>
                    <Text style={styles.badgeInfoText}>Digital</Text>
                  </View>
                </View>
                <Text style={styles.paymentOptionDesc}>
                  Pay securely with UPI, Credit/Debit Card, or Net Banking.
                </Text>
              </View>
              <Ionicons name="card-outline" size={22} color={paymentMethod === "ONLINE" ? colors.primary : colors.textMuted} />
            </View>
          </Pressable>
        </View>

        <View style={styles.selectedPaymentNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.selectedPaymentNoticeText}>
            Selected: <Text style={{ fontWeight: "700" }}>{paymentMethod === "COD" ? "Cash on Delivery (COD)" : "Pay Online (Razorpay)"}</Text> · {paymentMethod === "COD" ? "Pay the driver in cash according to the booking payment terms." : "Secure digital payment."}
          </Text>
        </View>
      </Card>

      <Notice message={error} />

      <Button
        title="Confirm & Submit Request"
        icon={<Ionicons name="checkmark-circle" size={18} color={colors.white} />}
        loading={busy}
        onPress={submit}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  cardHeaderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  routeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 4
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  routeRoleLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  routeAddressText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: colors.line,
    marginLeft: 6,
    marginVertical: 1
  },
  grid2: {
    flexDirection: "row",
    gap: 12
  },
  gridItem: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  gridLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  gridValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  noteBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 10,
    gap: 2
  },
  noteLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  noteText: {
    color: colors.textLight,
    fontSize: 13,
    fontStyle: "italic"
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  vehicleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  vehicleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  vehicleSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: "capitalize",
    marginTop: 1
  },
  paymentOptionList: {
    gap: 10,
    marginTop: 6
  },
  paymentOptionCard: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface
  },
  paymentOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt
  },
  paymentRadioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  radioDotActive: {
    borderColor: colors.primary
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  paymentOptionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  paymentOptionDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16
  },
  badgeSuccess: {
    backgroundColor: colors.badgePaidBg || "#D1FADF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeSuccessText: {
    color: colors.badgePaidText || "#027A48",
    fontSize: 10,
    fontWeight: "700"
  },
  badgeInfo: {
    backgroundColor: colors.badgePendingBg || "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeInfoText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700"
  },
  selectedPaymentNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt
  },
  selectedPaymentNoticeText: {
    flex: 1,
    color: colors.textLight,
    fontSize: 12,
    lineHeight: 16
  }
});
