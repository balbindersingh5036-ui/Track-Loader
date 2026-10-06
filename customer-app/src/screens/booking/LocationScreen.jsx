import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function LocationScreen({ route, navigation }) {
  const [pickupAddress, setPickupAddress] = useState(route.params?.pickup?.address || "");
  const [dropAddress, setDropAddress] = useState(route.params?.drop?.address || "");
  const [error, setError] = useState("");

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

    const pickup = {
      address: pickupAddress.trim(),
      latitude: 20.5937,
      longitude: 78.9629
    };
    const drop = {
      address: dropAddress.trim(),
      latitude: 20.5937,
      longitude: 78.9629
    };

    navigation.navigate("BookingGoods", {
      ...route.params,
      pickup,
      drop,
      vehicleType: route.params?.vehicleType,
      vehicleId: route.params?.vehicleId
    });
  };

  return (
    <Screen>
      <Heading
        title="Route Details"
        subtitle="Specify the pickup point and destination for your goods transport."
      />

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
            onChangeText={setPickupAddress}
            placeholder="e.g. Warehouse A, Civil Lines, Prayagraj"
            multiline
          />
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
            onChangeText={setDropAddress}
            placeholder="e.g. Shop 12, Transport Nagar, Lucknow"
            multiline
          />
        </View>
      </Card>

      <Notice message={error} />

      <Button
        title="Continue to Goods Details"
        icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
        iconPosition="right"
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
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  stepNumActive: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700"
  },
  stepLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4
  },
  stepLabelActive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 8
  },
  inputGroup: {
    gap: 8
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconCirclePickup: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCircleDrop: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center"
  },
  fieldLabel: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: "700"
  },
  routeConnector: {
    alignItems: "center",
    paddingVertical: 2
  },
  dashedLine: {
    width: 1,
    height: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.mutedLight
  }
});
