import React, { useEffect, useState } from "react";
import { Button, Card, Field, Heading, Notice, Screen } from "../../components/Phase12UI";
import userService from "../../services/userService";
import { getErrorMessage } from "../../utils/errorMessage";

export default function EditProfileScreen({ route }) {
  const [name, setName] = useState(route.params?.profile?.name || "");
  const [email, setEmail] = useState(route.params?.profile?.email || "");
  const [profileImage, setProfileImage] = useState(route.params?.profile?.profileImage || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await userService.updateProfile({ name: name.trim(), email: email.trim(), profileImage: profileImage.trim() });
      setSuccess("Profile updated.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await userService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password changed.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading title="Edit profile" subtitle="Only your name, email, and profile image can be changed here." />
      <Card>
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Profile image URL" value={profileImage} onChangeText={setProfileImage} autoCapitalize="none" />
        <Button title="Save profile" loading={busy} onPress={saveProfile} />
      </Card>
      <Card>
        <Heading title="Change password" subtitle="Your current password is required." />
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
        <Button title="Change password" secondary loading={busy} onPress={savePassword} />
      </Card>
      {success ? <Notice message={success} tone="warning" /> : null}
      <Notice message={error} />
    </Screen>
  );
}
