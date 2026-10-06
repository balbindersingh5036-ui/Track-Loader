import React from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../store/AuthContext";
import { Button, Card, Heading, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function SettingsScreen({ navigation }) {
  const { signOut } = useAuth();

  return (
    <Screen>
      <Heading
        title="Settings & Preferences"
        subtitle="Manage your account preferences, policies, and privacy."
      />

      {/* ACCOUNT & PREFERENCES */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account & App Controls</Text>
        <Card style={styles.menuCard}>
          <Pressable
            style={styles.menuRow}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <View style={styles.iconBox}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSub}>Update name, email, and password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.menuRow}
            onPress={() => navigation.navigate("Notifications")}
          >
            <View style={styles.iconBox}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Notification Center</Text>
              <Text style={styles.menuSub}>View updates and alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      {/* SUPPORT & LEGAL */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Support & Legal</Text>
        <Card style={styles.menuCard}>
          <Pressable
            style={styles.menuRow}
            onPress={() => navigation.navigate("Support")}
          >
            <View style={styles.iconBox}>
              <Ionicons name="headset-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Support & Complaints</Text>
              <Text style={styles.menuSub}>Help desk and dispute resolution</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.menuRowStatic}>
            <View style={styles.iconBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Privacy & Data Protection</Text>
              <Text style={styles.menuSub}>
                Your transport information is securely maintained by LoadBalbin for booking fulfillment.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* SIGN OUT */}
      <Button
        title="Sign Out"
        secondary
        icon={<Ionicons name="log-out-outline" size={16} color={colors.primary} />}
        onPress={signOut}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4
  },
  menuCard: {
    padding: 6,
    gap: 0
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12
  },
  menuRowStatic: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 12
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  menuTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: "700"
  },
  menuSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
    lineHeight: 16
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight,
    marginLeft: 56
  }
});
