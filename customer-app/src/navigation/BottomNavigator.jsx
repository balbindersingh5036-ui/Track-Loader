import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import HomeScreen from "../screens/home/HomeScreen";
import VehicleListScreen from "../screens/home/VehicleListScreen";
import MyBookingsScreen from "../screens/bookings/MyBookingsScreen";
import NotificationsScreen from "../screens/settings/NotificationScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import LocationScreen from "../screens/booking/LocationScreen";
import { colors } from "../theme/theme";

const Tab = createBottomTabNavigator();

export default function BottomNavigator() {
  const insets = useSafeAreaInsets();
  // Ensure a minimum padding if there's no safe area (like older Androids)
  const bottomPadding = Math.max(insets.bottom, 12);
  const navHeight = 64 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: navHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 6
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2
        }
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          )
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={MyBookingsScreen}
        options={{
          tabBarLabel: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "receipt" : "receipt-outline"}
              size={21}
              color={color}
            />
          )
        }}
      />
      <Tab.Screen
        name="Book"
        component={LocationScreen}
        options={{
          tabBarLabel: "Book",
          tabBarIcon: ({ color }) => (
            <View style={{
              backgroundColor: colors.accent,
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: Platform.OS === "ios" ? 0 : 20, // push up slightly on android to prevent clipping
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 5,
              elevation: 5,
              top: Platform.OS === "ios" ? -8 : 0 // visually center on iOS
            }}>
              <MaterialCommunityIcons name="truck-fast" size={26} color={colors.text} />
            </View>
          )
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: "Notifications",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={22}
              color={color}
            />
          )
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={21}
              color={color}
            />
          )
        }}
      />
    </Tab.Navigator>
  );
}
