import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';
import StatusBadge from './StatusBadge';

export default function AgencyHeader({
  agency,
  user,
  unreadCount = 0,
  onOpenNotifications,
  onOpenProfile
}) {
  const agencyName = agency?.agencyName || user?.name || 'LoadBalbin Agency';
  const approvalStatus = agency?.approvalStatus || 'pending';

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.brandingBlock}>
          <View style={styles.logoRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="business" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.brandTitle}>LoadBalbin</Text>
            <View style={styles.agencyTag}>
              <Text style={styles.agencyTagText}>AGENCY</Text>
            </View>
          </View>
          <Text style={styles.agencyName} numberOfLines={1}>
            {agencyName}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={onOpenNotifications}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed
            ]}
          >
            <Ionicons name="notifications-outline" size={21} color={theme.colors.ink} />
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agency Profile and KYC"
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.iconButtonPressed
            ]}
          >
            <Text style={styles.avatarText}>
              {agencyName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusRow}>
        <StatusBadge
          status={approvalStatus}
          label={
            approvalStatus === 'approved'
              ? 'Agency Verified'
              : approvalStatus === 'rejected'
              ? 'Verification Rejected'
              : 'Verification Pending Super Admin'
          }
          size="sm"
        />
        {agency?.city ? (
          <View style={styles.cityPill}>
            <Ionicons name="location-outline" size={12} color={theme.colors.muted} />
            <Text style={styles.cityText} numberOfLines={1}>
              {agency.city}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    gap: 8
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandingBlock: {
    flex: 1,
    marginRight: 12
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2
  },
  agencyTag: {
    backgroundColor: theme.colors.primaryGlow,
    borderColor: 'rgba(8, 169, 245, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  agencyTagText: {
    color: theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  agencyName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  iconButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }]
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.surface
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  cityText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '600'
  }
});
