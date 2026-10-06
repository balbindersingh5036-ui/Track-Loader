import React, { useCallback, useState } from "react";
import { Image, Text, View, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import userService from "../../services/userService";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function ProfileScreen({ navigation }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookingSummary, setBookingSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileResult, summaryResult] = await Promise.allSettled([
        userService.getProfile(),
        userService.getBookingsSummary()
      ]);
      if (profileResult.status === "rejected") throw profileResult.reason;
      setProfile(profileResult.value);
      if (summaryResult.status === "fulfilled") {
        setBookingSummary(summaryResult.value);
        setSummaryError("");
      } else {
        setSummaryError(getErrorMessage(summaryResult.reason));
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading profile..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading title="My Account" subtitle="Manage your profile and transport stats." />

      {error ? <Notice message={error} /> : null}

      {/* USER CARD */}
      {profile ? (
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            {profile.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{profile.name}</Text>
              <Text style={styles.userPhone}>{profile.phone}</Text>
              <Text style={styles.userEmail}>{profile.email || "No email added"}</Text>
            </View>

            <Pressable
              style={styles.editIconBtn}
              onPress={() => navigation.navigate("EditProfile", { profile })}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </Card>
      ) : null}

      {/* BOOKINGS SUMMARY STATS GRID */}
      {bookingSummary ? (
        <Card>
          <Text style={styles.cardHeaderTitle}>Transport Activity Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{bookingSummary.totalBookings || 0}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.warningText }]}>
                {bookingSummary.pendingBookings || 0}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.infoText }]}>
                {bookingSummary.acceptedBookings || 0}
              </Text>
              <Text style={styles.statLabel}>Accepted</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {bookingSummary.inProgressBookings || 0}
              </Text>
              <Text style={styles.statLabel}>Ongoing</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.successText }]}>
                {bookingSummary.completedBookings || 0}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.dangerText }]}>
                {bookingSummary.cancelledBookings || 0}
              </Text>
              <Text style={styles.statLabel}>Cancelled</Text>
            </View>
          </View>
        </Card>
      ) : summaryError ? (
        <Notice message={summaryError} />
      ) : null}

      {/* ACCOUNT QUICK ACTIONS */}
      <Card style={styles.menuCard}>
        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("EditProfile", { profile })}
        >
          <View style={styles.iconBox}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.menuTitle}>Edit Profile & Password</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("Support")}
        >
          <View style={styles.iconBox}>
            <Ionicons name="headset-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.menuTitle}>Support & Complaints</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("Settings")}
        >
          <View style={styles.iconBox}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.menuTitle}>Settings & Privacy</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </Card>

      <Button
        title="Sign Out"
        secondary
        icon={<Ionicons name="log-out-outline" size={16} color={colors.primary} />}
        onPress={signOut}
        style={{ marginTop: 4 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: {
    padding: 16
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceAlt
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  userName: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: "800"
  },
  userPhone: {
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2
  },
  userEmail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  cardHeaderTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statBox: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2
  },
  statNumber: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: "800"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
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
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  menuTitle: {
    flex: 1,
    color: colors.navy,
    fontSize: 14,
    fontWeight: "700"
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight,
    marginLeft: 56
  }
});
