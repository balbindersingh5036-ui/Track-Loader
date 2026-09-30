import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/home/HomeScreen";
import VehicleListScreen from "../screens/home/VehicleListScreen";
import MyBookingsScreen from "../screens/bookings/MyBookingsScreen";
import NotificationsScreen from "../screens/settings/NotificationScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { colors } from "../components/Phase12UI";

const Tab = createBottomTabNavigator();

export default function BottomNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontWeight: "600" }
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Vehicles" component={VehicleListScreen} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
