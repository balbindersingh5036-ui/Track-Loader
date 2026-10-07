import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import notificationService from "../../services/notificationService";
import configService from "../../services/configService";
import { subscribeToNotifications } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Heading, Loading, Notice, Screen } from "../../components/Phase12UI";
import { colors, shadows } from "../../theme/theme";

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const config = await configService.getPublicConfig();
      const isEnabled = config["notification.enabled"] !== false;
      setEnabled(isEnabled);
      if (!isEnabled) {
        setNotifications([]);
        setUnreadCount(0);
      } else {
        const [result, unread] = await Promise.all([
          notificationService.getNotifications({ limit: 100 }),
          notificationService.getUnreadCount()
        ]);
        setNotifications(result.notifications || []);
        setUnreadCount(unread);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    return subscribeToNotifications(() => load());
  }, [load]);

  const markAll = async () => {
    setError("");
    try {
      await notificationService.markAllAsRead();
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const openNotification = async (notification) => {
    setError("");
    try {
      let fullNotification = await notificationService.getNotification(notification._id);
      if (!fullNotification.isRead) {
        fullNotification = await notificationService.markAsRead(notification._id);
      }
      setNotifications((current) =>
        current.map((item) => (item._id === fullNotification._id ? fullNotification : item))
      );
      setUnreadCount((count) => Math.max(0, count - (notification.isRead ? 0 : 1)));
      Alert.alert(fullNotification.title, fullNotification.message);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Heading
        title="Notifications"
        subtitle={
          unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All caught up"
        }
        right={
          unreadCount > 0 && enabled ? (
            <Pressable style={styles.markAllBtn} onPress={markAll}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          ) : null
        }
      />

      {error ? <Notice message={error} /> : null}

      {loading ? (
        <Loading label="Loading notifications..." />
      ) : !enabled ? (
        <Empty
          icon="notifications-off-outline"
          title="Notifications Disabled"
          detail="Notifications are currently turned off by system settings."
        />
      ) : notifications.length === 0 ? (
        <Empty
          icon="notifications-outline"
          title="No Notifications Yet"
          detail="Live updates about your bookings and drivers will appear here."
        />
      ) : (
        <View style={styles.list}>
          {notifications.map((item) => {
            const isUnread = !item.isRead;
            return (
              <Pressable
                key={item._id}
                style={[
                  styles.notificationCard,
                  shadows.soft,
                  isUnread && styles.unreadCard
                ]}
                onPress={() => openNotification(item)}
              >
                <View style={styles.iconCol}>
                  <View
                    style={[
                      styles.iconCircle,
                      isUnread ? styles.iconCircleUnread : styles.iconCircleRead
                    ]}
                  >
                    <Ionicons
                      name={isUnread ? "notifications" : "notifications-outline"}
                      size={18}
                      color={isUnread ? colors.primary : colors.textMuted}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
                      {item.title}
                    </Text>
                    {isUnread ? <View style={styles.unreadDot} /> : null}
                  </View>

                  <Text style={styles.cardMessage} numberOfLines={3}>
                    {item.message}
                  </Text>

                  <Text style={styles.cardTime}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8
  },
  markAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  list: {
    gap: 10
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12
  },
  unreadCard: {
    borderColor: colors.primaryMuted,
    backgroundColor: "#F6FBFB"
  },
  iconCol: {
    paddingTop: 2
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCircleUnread: {
    backgroundColor: colors.surfaceAlt
  },
  iconCircleRead: {
    backgroundColor: colors.surfaceAlt
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1
  },
  cardTitleUnread: {
    fontWeight: "800"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 6
  },
  cardMessage: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  cardTime: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2
  }
});
