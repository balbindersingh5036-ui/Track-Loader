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
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, shadows } from "../theme/theme";

export { colors, shadows };

export const Screen = ({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  edges = ["top", "left", "right"],
  contentContainerStyle
}) => {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentContainerStyle, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {content}
    </SafeAreaView>
  );
};

export const Heading = ({ title, subtitle, action, right, style }) => (
  <View style={[styles.heading, style]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {action || right ? <View>{action || right}</View> : null}
  </View>
);

export const SectionHeader = ({ title, subtitle, action, style }) => (
  <View style={[styles.sectionHeader, style]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {action ? <View>{action}</View> : null}
  </View>
);

export const Card = ({ children, style, pressed, onPress }) => {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed: isPressed }) => [
          styles.card,
          shadows.soft,
          isPressed && styles.cardPressed,
          style
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadows.soft, style]}>{children}</View>;
};

export const Button = ({
  title,
  onPress,
  disabled,
  secondary,
  outline,
  danger,
  loading,
  icon,
  iconPosition = "left",
  style,
  textStyle
}) => {
  const isSecondary = secondary || outline;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isSecondary ? colors.primary : colors.white}
        />
      ) : (
        <View style={styles.buttonInner}>
          {icon && iconPosition === "left" ? (
            <View style={{ marginRight: 8 }}>{icon}</View>
          ) : null}
          <Text
            style={[
              styles.buttonText,
              isSecondary && styles.buttonTextSecondary,
              danger && styles.buttonTextDanger,
              textStyle
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" ? (
            <View style={{ marginLeft: 8 }}>{icon}</View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

export const Field = ({
  label,
  helper,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  style,
  multiline,
  ...props
}) => (
  <View style={[styles.fieldWrap, style]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.inputContainer, multiline && styles.multilineContainer, error && styles.inputError]}>
      {icon ? <View style={styles.inputLeftIcon}>{icon}</View> : null}
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.multilineInput, icon && { paddingLeft: 6 }]}
      />
      {rightIcon ? (
        <Pressable onPress={onRightIconPress} style={styles.inputRightIcon}>
          {rightIcon}
        </Pressable>
      ) : null}
    </View>
    {error ? <Text style={styles.fieldErrorText}>{error}</Text> : helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
  </View>
);

export const Notice = ({ message, tone = "error", icon, style }) => {
  if (!message) return null;

  let iconName = "alert-circle-outline";
  let noticeStyle = styles.noticeError;
  let textStyle = styles.noticeTextError;

  if (tone === "warning") {
    iconName = "warning-outline";
    noticeStyle = styles.noticeWarning;
    textStyle = styles.noticeTextWarning;
  } else if (tone === "success") {
    iconName = "checkmark-circle-outline";
    noticeStyle = styles.noticeSuccess;
    textStyle = styles.noticeTextSuccess;
  } else if (tone === "info") {
    iconName = "information-circle-outline";
    noticeStyle = styles.noticeInfo;
    textStyle = styles.noticeTextInfo;
  }

  return (
    <View style={[styles.notice, noticeStyle, style]}>
      <Ionicons
        name={icon || iconName}
        size={18}
        color={textStyle.color}
        style={{ marginTop: 1 }}
      />
      <Text style={[styles.noticeText, textStyle]}>{message}</Text>
    </View>
  );
};

export const Loading = ({ label = "Loading..." }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

export const Empty = ({
  title = "Nothing to display",
  detail,
  icon = "cube-outline",
  actionTitle,
  onAction,
  style
}) => (
  <Card style={[styles.emptyCard, style]}>
    <View style={styles.emptyIconWrap}>
      <Ionicons name={icon} size={36} color={colors.textMuted} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {detail ? <Text style={styles.emptyDetail}>{detail}</Text> : null}
    {actionTitle && onAction ? (
      <Button
        title={actionTitle}
        secondary
        onPress={onAction}
        style={{ marginTop: 8, minHeight: 40 }}
      />
    ) : null}
  </Card>
);

export const Status = ({ value, style }) => {
  const norm = (value || "unknown").toLowerCase().replace(/_/g, "-");
  let badgeStyle = styles.statusNeutral;
  let textStyle = styles.statusTextNeutral;
  let label = norm.replace(/-/g, " ");

  if (["completed", "accepted", "approved", "delivered", "active", "paid"].includes(norm)) {
    badgeStyle = styles.statusSuccess;
    textStyle = styles.statusTextSuccess;
  } else if (["pending", "in-progress", "assigned", "ongoing"].includes(norm)) {
    badgeStyle = styles.statusWarning;
    textStyle = styles.statusTextWarning;
  } else if (["cancelled", "rejected", "failed", "suspended", "inactive"].includes(norm)) {
    badgeStyle = styles.statusDanger;
    textStyle = styles.statusTextDanger;
  }

  return (
    <View style={[styles.statusBadge, badgeStyle, style]}>
      <Text style={[styles.statusText, textStyle]}>{label.toUpperCase()}</Text>
    </View>
  );
};

export const AppHeader = ({ title, subtitle, right, onBack, showBack = false }) => (
  <View style={styles.appHeader}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
      {showBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? <Text style={styles.appHeaderTitle} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={styles.appHeaderSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </View>
    {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
  </View>
);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 12
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 2
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 1
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }]
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: colors.primary
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  buttonDanger: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonPressed: {
    opacity: 0.88
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  buttonTextSecondary: {
    color: colors.primary
  },
  buttonTextDanger: {
    color: colors.dangerText
  },
  fieldWrap: {
    gap: 6
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12
  },
  multilineContainer: {
    minHeight: 90,
    alignItems: "flex-start",
    paddingVertical: 10
  },
  input: {
    flex: 1,
    color: colors.textLight,
    fontSize: 15,
    paddingVertical: 8
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top"
  },
  inputError: {
    borderColor: colors.danger
  },
  inputLeftIcon: {
    marginRight: 8
  },
  inputRightIcon: {
    padding: 4
  },
  fieldHelper: {
    color: colors.textMuted,
    fontSize: 12
  },
  fieldErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "500"
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1
  },
  noticeError: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder
  },
  noticeWarning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder
  },
  noticeSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder
  },
  noticeInfo: {
    backgroundColor: colors.infoBg,
    borderColor: colors.infoBorder
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500"
  },
  noticeTextError: {
    color: colors.dangerText
  },
  noticeTextWarning: {
    color: colors.warningText
  },
  noticeTextSuccess: {
    color: colors.successText
  },
  noticeTextInfo: {
    color: colors.infoText
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500"
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
    borderStyle: "dashed"
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  emptyDetail: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  statusSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder
  },
  statusTextSuccess: {
    color: colors.successText
  },
  statusWarning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder
  },
  statusTextWarning: {
    color: colors.warningText
  },
  statusDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder
  },
  statusTextDanger: {
    color: colors.dangerText
  },
  statusNeutral: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.line
  },
  statusTextNeutral: {
    color: colors.textMuted
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  link: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  appHeaderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  appHeaderSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1
  },
  backButton: {
    padding: 4,
    marginRight: 4
  }
});

export default {
  colors,
  shadows,
  Screen,
  Heading,
  SectionHeader,
  Card,
  Button,
  Field,
  Notice,
  Loading,
  Empty,
  Status,
  AppHeader,
  styles
};
