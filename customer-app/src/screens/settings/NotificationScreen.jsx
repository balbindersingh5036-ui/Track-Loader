import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import notificationService from "../../services/notificationService";
import configService from "../../services/configService";
import { subscribeToNotifications } from "../../services/socketService";
import { getErrorMessage } from "../../utils/errorMessage";
import { Button, Card, Empty, Heading, Loading, Notice, Screen, styles } from "../../components/Phase12UI";

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
      if (!fullNotification.isRead) fullNotification = await notificationService.markAsRead(notification._id);
      setNotifications((current) => current.map((item) =>
        item._id === fullNotification._id ? fullNotification : item
      ));
      setUnreadCount((count) => Math.max(0, count - (notification.isRead ? 0 : 1)));
      Alert.alert(fullNotification.title, fullNotification.message);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Heading title="Notifications" subtitle={`${unreadCount} unread`} />
      {error ? <Notice message={error} /> : null}
      {unreadCount > 0 && enabled ? <Button title="Mark all as read" secondary onPress={markAll} /> : null}
      {loading ? <Loading label="Loading notifications..." /> : !enabled ? (
        <Empty title="Notifications are disabled" />
      ) : notifications.length ? notifications.map((notification) => (
        <Pressable key={notification._id} onPress={() => openNotification(notification)}>
          <Card>
            <Text style={styles.cardTitle}>{notification.title}{notification.isRead ? "" : " · New"}</Text>
            <Text style={styles.muted}>{notification.message}</Text>
            <Text style={styles.muted}>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ""}</Text>
          </Card>
        </Pressable>
      )) : !error ? <Empty title="You're all caught up" detail="New booking updates will appear here." /> : null}
    </Screen>
  );
}
