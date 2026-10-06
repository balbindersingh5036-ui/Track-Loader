import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import { colors } from "../../theme/theme";

export default function GoodsDetailsScreen({ route, navigation }) {
  const [goods, setGoods] = useState(route.params?.goods || "");
  const [weightValue, setWeightValue] = useState(
    route.params?.weight?.value !== undefined ? String(route.params.weight.value) : ""
  );
  const [weightUnit, setWeightUnit] = useState(route.params?.weight?.unit || "kg");
  const [preferredPickupDate, setPreferredPickupDate] = useState(
    route.params?.preferredPickupDate || ""
  );
  const [preferredPickupTime, setPreferredPickupTime] = useState(
    route.params?.preferredPickupTime || ""
  );
  const [customerNote, setCustomerNote] = useState(route.params?.customerNote || "");
  const [error, setError] = useState("");

  const continueToVehicle = () => {
    setError("");
    const weight = Number(weightValue);
    if (!goods.trim()) {
      return setError("Please describe the goods being transported.");
    }
    if (!weightValue.trim() || !Number.isFinite(weight) || weight < 0) {
      return setError("Please enter a valid numeric weight.");
    }
    if (!["kg", "ton"].includes(weightUnit)) {
      return setError("Please select either kilograms (kg) or tons (ton).");
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(preferredPickupDate) ||
      Number.isNaN(Date.parse(preferredPickupDate))
    ) {
      return setError("Please enter the pickup date in YYYY-MM-DD format (e.g. 2026-10-15).");
    }
    if (!/^\d{2}:\d{2}$/.test(preferredPickupTime)) {
      return setError("Please enter the pickup time in HH:MM 24-hr format (e.g. 14:30).");
    }

    navigation.navigate("BookingVehicle", {
      ...route.params,
      goods: goods.trim(),
      weight: { value: weight, unit: weightUnit },
      preferredPickupDate,
      preferredPickupTime,
      customerNote: customerNote.trim()
    });
  };

  return (
    <Screen>
      <Heading
        title="Goods & Schedule"
        subtitle="Provide cargo specifications and your preferred loading time."
      />

      {/* STEP INDICATOR */}
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, styles.stepDotDone]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
        <Text style={styles.stepLabelDone}>Location</Text>
        <View style={[styles.stepLine, styles.stepLineDone]} />
        <View style={[styles.stepDot, styles.stepDotActive]}>
          <Text style={styles.stepNumActive}>2</Text>
        </View>
        <Text style={styles.stepLabelActive}>Goods</Text>
        <View style={styles.stepLine} />
        <View style={styles.stepDot}>
          <Text style={styles.stepNum}>3</Text>
        </View>
        <Text style={styles.stepLabel}>Vehicle</Text>
      </View>

      <Card>
        <Text style={styles.cardSectionTitle}>Cargo Information</Text>

        <Field
          label="Goods Description"
          value={goods}
          onChangeText={setGoods}
          placeholder="e.g. Commercial cartons, furniture, metal pipes"
          icon={<Ionicons name="cube-outline" size={18} color={colors.muted} />}
        />

        <View style={styles.weightRow}>
          <Field
            style={{ flex: 1 }}
            label="Cargo Weight"
            value={weightValue}
            onChangeText={setWeightValue}
            keyboardType="decimal-pad"
            placeholder="e.g. 500"
            icon={<Ionicons name="speedometer-outline" size={18} color={colors.muted} />}
          />

          <View style={styles.unitSelector}>
            <Text style={styles.unitLabel}>Unit</Text>
            <View style={styles.unitPills}>
              <Pressable
                style={[styles.unitPill, weightUnit === "kg" && styles.unitPillActive]}
                onPress={() => setWeightUnit("kg")}
              >
                <Text style={[styles.unitPillText, weightUnit === "kg" && styles.unitPillTextActive]}>
                  KG
                </Text>
              </Pressable>
              <Pressable
                style={[styles.unitPill, weightUnit === "ton" && styles.unitPillActive]}
                onPress={() => setWeightUnit("ton")}
              >
                <Text style={[styles.unitPillText, weightUnit === "ton" && styles.unitPillTextActive]}>
                  TON
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardSectionTitle}>Pickup Schedule</Text>

        <View style={styles.scheduleRow}>
          <Field
            style={{ flex: 1 }}
            label="Pickup Date"
            value={preferredPickupDate}
            onChangeText={setPreferredPickupDate}
            placeholder="YYYY-MM-DD"
            icon={<Ionicons name="calendar-outline" size={18} color={colors.muted} />}
          />

          <Field
            style={{ flex: 1 }}
            label="Pickup Time"
            value={preferredPickupTime}
            onChangeText={setPreferredPickupTime}
            placeholder="HH:MM (24h)"
            icon={<Ionicons name="time-outline" size={18} color={colors.muted} />}
          />
        </View>

        <Field
          label="Special Instructions / Notes (Optional)"
          value={customerNote}
          onChangeText={setCustomerNote}
          multiline
          placeholder="e.g. Loading dock at gate 3, handle with care"
          icon={<Ionicons name="document-text-outline" size={18} color={colors.muted} />}
        />
      </Card>

      <Notice message={error} />

      <Button
        title="Continue to Vehicle Selection"
        icon={<Ionicons name="arrow-forward" size={16} color={colors.white} />}
        iconPosition="right"
        onPress={continueToVehicle}
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
  stepDotDone: {
    backgroundColor: colors.primary
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
  stepLabelDone: {
    color: colors.primary,
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
  stepLineDone: {
    backgroundColor: colors.primary
  },
  cardSectionTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12
  },
  unitSelector: {
    gap: 6,
    paddingBottom: 2
  },
  unitLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: "600"
  },
  unitPills: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line
  },
  unitPill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  unitPillActive: {
    backgroundColor: colors.primary
  },
  unitPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  unitPillTextActive: {
    color: colors.white
  },
  scheduleRow: {
    flexDirection: "row",
    gap: 12
  }
});
