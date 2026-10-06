import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import userService from "../../services/userService";
import { getErrorMessage } from "../../utils/errorMessage";
import { colors } from "../../theme/theme";

export default function EditProfileScreen({ route }) {
  const [name, setName] = useState(route.params?.profile?.name || "");
  const [email, setEmail] = useState(route.params?.profile?.email || "");
  const [profileImage, setProfileImage] = useState(route.params?.profile?.profileImage || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (route.params?.profile) {
      setName(route.params.profile.name || "");
      setEmail(route.params.profile.email || "");
      setProfileImage(route.params.profile.profileImage || "");
    }
  }, [route.params?.profile]);

  const saveProfile = async () => {
    if (busyProfile) return;
    setBusyProfile(true);
    setError("");
    setSuccess("");
    try {
      await userService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        profileImage: profileImage.trim()
      });
      setSuccess("Your profile details have been saved.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyProfile(false);
    }
  };

  const savePassword = async () => {
    if (busyPassword) return;
    if (!currentPassword || !newPassword) {
      setError("Please provide both your current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    setBusyPassword(true);
    setError("");
    setSuccess("");
    try {
      await userService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Your account password was successfully updated.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyPassword(false);
    }
  };

  return (
    <Screen>
      <Heading
        title="Edit Profile"
        subtitle="Update your personal details and account credentials."
      />

      {success ? <Notice message={success} tone="success" /> : null}
      {error ? <Notice message={error} /> : null}

      {/* PERSONAL INFO CARD */}
      <Card>
        <Text style={styles.cardHeaderTitle}>Personal Information</Text>

        <Field
          label="Full Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholder="e.g. Amit Sharma"
          icon={<Ionicons name="person-outline" size={18} color={colors.muted} />}
        />

        <Field
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          icon={<Ionicons name="mail-outline" size={18} color={colors.muted} />}
        />

        <Field
          label="Profile Photo URL (Optional)"
          value={profileImage}
          onChangeText={setProfileImage}
          autoCapitalize="none"
          placeholder="https://..."
          icon={<Ionicons name="image-outline" size={18} color={colors.muted} />}
        />

        <Button
          title="Save Profile Changes"
          loading={busyProfile}
          onPress={saveProfile}
          style={{ marginTop: 6 }}
        />
      </Card>

      {/* SECURITY CARD */}
      <Card>
        <Text style={styles.cardHeaderTitle}>Change Password</Text>
        <Text style={styles.cardHeaderSub}>
          Enter your existing password to establish a new one.
        </Text>

        <Field
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrentPass}
          autoComplete="current-password"
          placeholder="Enter current password"
          icon={<Ionicons name="lock-closed-outline" size={18} color={colors.muted} />}
          rightIcon={
            <Ionicons
              name={showCurrentPass ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={colors.muted}
            />
          }
          onRightIconPress={() => setShowCurrentPass(!showCurrentPass)}
        />

        <Field
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNewPass}
          autoComplete="new-password"
          placeholder="Minimum 6 characters"
          icon={<Ionicons name="key-outline" size={18} color={colors.muted} />}
          rightIcon={
            <Ionicons
              name={showNewPass ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={colors.muted}
            />
          }
          onRightIconPress={() => setShowNewPass(!showNewPass)}
        />

        <Button
          title="Update Password"
          secondary
          loading={busyPassword}
          onPress={savePassword}
          style={{ marginTop: 6 }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHeaderTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: "700"
  },
  cardHeaderSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4
  }
});
