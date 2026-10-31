import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import EmptyState from '../components/EmptyState';

export default function NotificationsTab({
  notifications = [],
  unreadCount = 0,
  loading = false,
  refreshing = false,
  onRefresh,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectNotification
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [markingAll, setMarkingAll] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.read && !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const handleMarkAll = async () => {
    if (onMarkAllAsRead && !markingAll) {
      setMarkingAll(true);
      try {
        await onMarkAllAsRead();
      } finally {
        setMarkingAll(false);
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
      case 'trip':
        return { name: 'cube-outline', color: theme.colors.primary };
      case 'driver':
      case 'driver_request':
        return { name: 'person-add-outline', color: theme.colors.accent };
      case 'verification':
      case 'kyc':
        return { name: 'shield-checkmark-outline', color: theme.colors.green };
      case 'alert':
      case 'warning':
        return { name: 'alert-circle-outline', color: theme.colors.danger };
      default:
        return { name: 'notifications-outline', color: theme.colors.teal };
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {/* 1. TOP CONTROLS & FILTER */}
      <View style={styles.controlsRow}>
        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'all' && styles.filterChipTextActive
              ]}
            >
              All ({notifications.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilter('unread')}
            style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'unread' && styles.filterChipTextActive
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </Pressable>
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={handleMarkAll}
            disabled={markingAll}
            style={({ pressed }) => [
              styles.markAllBtn,
              pressed && styles.markAllBtnPressed
            ]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* 2. NOTIFICATIONS LIST */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title={filter === 'unread' ? 'No Unread Alerts' : 'No Notifications'}
          description={
            filter === 'unread'
              ? 'You have caught up with all dispatch and driver notifications.'
              : 'Important announcements, driver joining requests, and dispatch notices will show here.'
          }
          actionLabel={filter === 'unread' ? 'View All' : undefined}
          onAction={filter === 'unread' ? () => setFilter('all') : undefined}
        />
      ) : (
        <View style={styles.list}>
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.read && !notif.isRead;
            const iconConfig = getNotificationIcon(notif.type);

            return (
              <Pressable
                key={notif._id || notif.id}
                onPress={() => {
                  if (isUnread && onMarkAsRead) {
                    onMarkAsRead(notif._id || notif.id);
                  }
                  if (onSelectNotification) {
                    onSelectNotification(notif);
                  }
                }}
                style={({ pressed }) => [
                  styles.notifCard,
                  isUnread && styles.notifCardUnread,
                  pressed && styles.notifCardPressed
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${iconConfig.color}15` }
                  ]}
                >
                  <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.notifTitle,
                        isUnread && styles.notifTitleUnread
                      ]}
                      numberOfLines={1}
                    >
                      {notif.title || 'System Notification'}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.notifMessage} numberOfLines={3}>
                    {notif.message || notif.body || 'No description provided.'}
                  </Text>

                  <Text style={styles.notifTime}>
                    {formatTime(notif.createdAt || notif.timestamp)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.bg
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: theme.spacing.md
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  filterChipText: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold
  },
  filterChipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.typography.weights.bold
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm
  },
  markAllBtnPressed: {
    opacity: 0.7
  },
  markAllText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold
  },
  list: {
    gap: theme.spacing.sm
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card
  },
  notifCardUnread: {
    backgroundColor: `${theme.colors.card}`,
    borderColor: `${theme.colors.primary}60`
  },
  notifCardPressed: {
    opacity: 0.8
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  notifTitle: {
    color: theme.colors.ink,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    flex: 1
  },
  notifTitleUnread: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.white
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 6
  },
  notifMessage: {
    color: theme.colors.muted,
    fontSize: theme.typography.sizes.xs,
    lineHeight: 18
  },
  notifTime: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 2
  }
});
