import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  ink: "#172B3A",
  muted: "#61717D",
  primary: "#086B64",
  primaryDark: "#064D49",
  canvas: "#F4F7F6",
  white: "#FFFFFF",
  line: "#DCE5E2",
  danger: "#B42318",
  warning: "#9A6700",
  success: "#16794B"
};

export const Screen = ({ children, scroll = true, refreshing, onRefresh, style }) => {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={[styles.content, style]}>{children}</View>;
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
};

export const Heading = ({ title, subtitle }) => (
  <View style={styles.heading}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

export const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export const Button = ({ title, onPress, disabled, secondary, loading, style }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [
      styles.button,
      secondary && styles.buttonSecondary,
      (disabled || loading) && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
      style
    ]}
  >
    {loading ? <ActivityIndicator color={secondary ? colors.primary : colors.white} /> : (
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    )}
  </Pressable>
);

export const Field = ({ label, style, multiline, ...props }) => (
  <View style={[styles.fieldWrap, style]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor="#8A9995"
      style={[styles.input, multiline && styles.multiline]}
    />
  </View>
);

export const Notice = ({ message, tone = "error" }) => message ? (
  <View style={[styles.notice, tone === "warning" && styles.warningNotice, tone === "success" && styles.successNotice]}>
    <Text style={[styles.noticeText, tone === "success" && styles.successNoticeText]}>{message}</Text>
  </View>
) : null;

export const Loading = ({ label = "Loading..." }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.muted}>{label}</Text>
  </View>
);

export const Empty = ({ title, detail }) => (
  <Card>
    <Text style={styles.cardTitle}>{title}</Text>
    {detail ? <Text style={styles.muted}>{detail}</Text> : null}
  </Card>
);

export const Status = ({ value }) => {
  const label = value === "in-progress" ? "In progress" : (value || "Unknown").replaceAll("-", " ");
  return <Text style={styles.status}>{label.toUpperCase()}</Text>;
};

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  heading: { gap: 4, marginBottom: 4 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: { alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 11, paddingHorizontal: 16, backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  buttonTextSecondary: { color: colors.primary },
  fieldWrap: { gap: 6 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  notice: { borderRadius: 10, padding: 12, backgroundColor: "#FDECEA" },
  warningNotice: { backgroundColor: "#FFF4D6" },
  successNotice: { backgroundColor: "#E8F5EE" },
  successNoticeText: { color: colors.success },
  noticeText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  status: { alignSelf: "flex-start", color: colors.primaryDark, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, backgroundColor: "#DDF3EF", overflow: "hidden", borderRadius: 20, paddingVertical: 5, paddingHorizontal: 9 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  link: { color: colors.primary, fontWeight: "700" }
});
