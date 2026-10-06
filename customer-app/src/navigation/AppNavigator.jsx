import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomNavigator from "./BottomNavigator";
import VehicleDetailsScreen from "../screens/home/VehicleDetailsScreen";
import VehicleTypeScreen from "../screens/home/VehicleTypeScreen";
import VehicleListScreen from "../screens/home/VehicleListScreen";
import LocationScreen from "../screens/booking/LocationScreen";
import GoodsDetailsScreen from "../screens/booking/GoodsDetailsScreen";
import VehicleSelectionScreen from "../screens/booking/VehicleSelectionScreen";
import FareScreen from "../screens/booking/FareScreen";
import BookingConfirmScreen from "../screens/booking/BookingConfirmScreen";
import BookingSuccessScreen from "../screens/booking/BookingSuccessScreen";
import BookingDetailsScreen from "../screens/bookings/BookingDetailsScreen";
import BookingReceiptScreen from "../screens/bookings/BookingReceiptScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import NotificationScreen from "../screens/settings/NotificationScreen";
import RatingScreen from "../screens/rating/RatingScreen";
import FeedbackScreen from "../screens/rating/FeedbackScreen";
import SupportScreen from "../screens/settings/SupportScreen";
import { colors } from "../theme/theme";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface
        },
        headerTintColor: colors.navy,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
          color: colors.navy
        },
        headerShadowVisible: false,
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={BottomNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VehicleType"
        component={VehicleTypeScreen}
        options={{ title: "Vehicle Types" }}
      />
      <Stack.Screen
        name="VehicleList"
        component={VehicleListScreen}
        options={{ title: "Available Vehicles" }}
      />
      <Stack.Screen
        name="VehicleDetails"
        component={VehicleDetailsScreen}
        options={{ title: "Vehicle Details" }}
      />
      <Stack.Screen
        name="BookingLocation"
        component={LocationScreen}
        options={{ title: "Pickup & Drop Location" }}
      />
      <Stack.Screen
        name="BookingGoods"
        component={GoodsDetailsScreen}
        options={{ title: "Goods Information" }}
      />
      <Stack.Screen
        name="BookingVehicle"
        component={VehicleSelectionScreen}
        options={{ title: "Select Vehicle" }}
      />
      <Stack.Screen
        name="FareScreen"
        component={FareScreen}
        options={{ title: "Fare Estimate" }}
      />
      <Stack.Screen
        name="BookingConfirm"
        component={BookingConfirmScreen}
        options={{ title: "Review Booking" }}
      />
      <Stack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
        options={{ title: "Booking Confirmed", headerBackVisible: false }}
      />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{ title: "Booking Details" }}
      />
      <Stack.Screen
        name="BookingReceipt"
        component={BookingReceiptScreen}
        options={{ title: "Booking Receipt" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit Profile" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{ title: "Notifications" }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ title: "Rate Delivery" }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: "Share Feedback" }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ title: "Support & Complaints" }}
      />
    </Stack.Navigator>
  );
}
