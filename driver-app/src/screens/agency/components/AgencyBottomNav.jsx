import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './AgencyTheme';

export const MAIN_TABS = [
  {
    id: 'Overview',
    label: 'Overview',
    icon: 'home-outline',
    activeIcon: 'home'
  },
  {
    id: 'Drivers',
    label: 'Drivers',
    icon: 'people-outline',
    activeIcon: 'people'
  },
  {
    id: 'Fleet',
    label: 'Fleet',
    icon: 'bus-outline',
    activeIcon: 'bus'
  },
  {
    id: 'Bookings',
    label: 'Bookings',
    icon: 'clipboard-outline',
    activeIcon: 'clipboard'
  },
  {
    id: 'More',
    label: 'More',
    icon: 'grid-outline',
    activeIcon: 'grid'
  }
];

export default function AgencyBottomNav({
  activeTab,
  onSelectTab,
  driverRequestsCount = 0,
  pendingBookingsCount = 0,
  moreBadgeCount = 0
}) {
  const getBadgeCount = (tabId) => {
    if (tabId === 'Drivers') return driverRequestsCount;
    if (tabId === 'Bookings') return pendingBookingsCount;
    if (tabId === 'More') return moreBadgeCount;
    return 0;
  };

  // Check if current tab is one of the secondary tabs mapped to "More"
  const isMoreActive = activeTab === 'More' ||
    ['Earnings', 'ProfileKyc', 'Notifications', 'Support'].includes(activeTab);

  return (
    <View style={styles.navBar}>
      {MAIN_TABS.map((tab) => {
        const isActive = tab.id === 'More' ? isMoreActive : activeTab === tab.id;
        const badge = getBadgeCount(tab.id);

        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            onPress={() => onSelectTab(tab.id)}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.tabItemPressed
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? theme.colors.primary : theme.colors.muted}
              />
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.colors.primary : theme.colors.muted,
                  fontWeight: isActive ? '800' : '600'
                }
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {isActive ? <View style={styles.activeIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    zIndex: 100,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -3px 10px rgba(0, 0, 0, 0.3)' }
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.3,
        shadowRadius: 5
      })
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 48,
    position: 'relative'
  },
  tabItemPressed: {
    opacity: 0.75
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: theme.colors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.surface
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 18,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.primary
  }
});
