import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/AgencyTheme';
import StatusBadge from '../components/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';

export default function MoreTab({
  agency,
  user,
  unreadCount = 0,
  completedBookingsCount = 0,
  onNavigateSection,
  onLogout
}) {
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const menuItems = [
    {
      id: 'Earnings',
      title: 'Earnings & Completed Trips',
      subtitle: `${completedBookingsCount} completed order${completedBookingsCount === 1 ? '' : 's'}`,
      icon: 'wallet-outline',
      iconColor: theme.colors.green,
      badge: null
    },
    {
      id: 'ProfileKyc',
      title: 'Agency Profile & KYC',
      subtitle: 'Owner identity & commercial licences',
      icon: 'shield-checkmark-outline',
      iconColor: theme.colors.primary,
      status: agency?.approvalStatus
    },
    {
      id: 'Notifications',
      title: 'Notifications & Alerts',
      subtitle: 'Dispatch and joining announcements',
      icon: 'notifications-outline',
      iconColor: theme.colors.accent,
      badge: unreadCount > 0 ? `${unreadCount} New` : null
    },
    {
      id: 'Support',
      title: 'Help & Support',
      subtitle: 'Assistance, hotline & guidelines',
      icon: 'help-buoy-outline',
      iconColor: theme.colors.teal,
      badge: null
    }
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. AGENCY IDENTITY SUMMARY */}
      <View style={styles.agencySummaryCard}>
        <View style={styles.avatarBubble}>
          <Text style={styles.avatarLetter}>
            {(agency?.agencyName || user?.name || 'A').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.agencyName} numberOfLines={1}>
            {agency?.agencyName || user?.name || 'LoadBalbin Agency'}
          </Text>
          <Text style={styles.ownerContact} numberOfLines={1}>
            {agency?.phone || user?.phone || 'No phone registered'}
          </Text>
          <StatusBadge
            status={agency?.approvalStatus}
            label={agency?.approvalStatus === 'approved' ? 'Verified Agency' : 'Verification Pending'}
            size="sm"
            style={{ marginTop: 4 }}
          />
        </View>
      </View>

      {/* 2. MENU SECTIONS */}
      <View style={styles.menuGroup}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onNavigateSection(item.id)}
            style={({ pressed }) => [
              styles.menuItem,
              index !== menuItems.length - 1 && styles.menuItemBorder,
              pressed && styles.menuItemPressed
            ]}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: `${item.iconColor}15` }]}>
              <Ionicons name={item.icon} size={22} color={item.iconColor} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>

            {item.badge ? (
              <View style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>{item.badge}</Text>
              </View>
            ) : null}

            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </Pressable>
        ))}
      </View>

      {/* 3. APP INFO & LOGOUT */}
      <View style={styles.menuGroup}>
        <Pressable
          onPress={() => setLogoutModalVisible(true)}
          style={({ pressed }) => [
            styles.menuItem,
            pressed && styles.menuItemPressed
          ]}
        >
          <View style={[styles.menuIconContainer, { backgroundColor: theme.colors.dangerGlow }]}>
            <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: theme.colors.danger }]}>Sign Out</Text>
            <Text style={styles.menuSubtitle}>Disconnect current agency session</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
        </Pressable>
      </View>

      {/* 4. FOOTER BRANDING */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>LoadBalbin Goods Logistics</Text>
        <Text style={styles.footerVersion}>Agency Mobile Management Portal v0.1.0</Text>
      </View>

      {/* LOGOUT CONFIRMATION MODAL */}
      <ConfirmationModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={() => {
          setLogoutModalVisible(false);
          onLogout();
        }}
        title="Sign Out"
        message="Are you sure you want to log out of your agency account?"
        confirmLabel="Sign Out"
        danger
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.md,
    paddingBottom: 120,
    gap: 16
  },
  agencySummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    gap: 14
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900'
  },
  agencyName: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '800'
  },
  ownerContact: {
    color: theme.colors.muted,
    fontSize: 12
  },
  menuGroup: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden'
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSubtle
  },
  menuItemPressed: {
    backgroundColor: theme.colors.surface
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '700'
  },
  menuSubtitle: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 1
  },
  itemBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full
  },
  itemBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4
  },
  footerBrand: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  footerVersion: {
    color: theme.colors.subtle,
    fontSize: 11
  }
});
