import React, { useCallback, useState } from "react";
import { Image, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import userService from "../../services/userService";
import { useAuth } from "../../store/AuthContext";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Heading, Loading, Notice, Screen, styles } from "../../components/Phase12UI";

export default function ProfileScreen({ navigation }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setProfile(await userService.getProfile());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (loading) return <Screen><Loading label="Loading profile..." /></Screen>;
  return (
    <Screen>
      <Heading title="Profile" subtitle="Your customer account details." />
      {error ? <Notice message={error} /> : null}
      {profile ? (
        <Card>
          {profile.profileImage ? <Image source={{ uri: profile.profileImage }} style={{ width: 88, height: 88, borderRadius: 44 }} /> : null}
          <Text style={styles.cardTitle}>{profile.name}</Text>
          <Text style={styles.muted}>{profile.phone}</Text>
          <Text style={styles.muted}>{profile.email || "No email added"}</Text>
        </Card>
      ) : null}
      <Button title="Edit profile and password" onPress={() => navigation.navigate("EditProfile", { profile })} />
      <Button title="Sign out" secondary onPress={signOut} />
    </Screen>
  );
}
