import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomNavigator from "./BottomNavigator";
import VehicleDetailsScreen from "../screens/home/VehicleDetailsScreen";
import LocationScreen from "../screens/booking/LocationScreen";
import GoodsDetailsScreen from "../screens/booking/GoodsDetailsScreen";
import VehicleSelectionScreen from "../screens/booking/VehicleSelectionScreen";
import BookingConfirmScreen from "../screens/booking/BookingConfirmScreen";
import BookingSuccessScreen from "../screens/booking/BookingSuccessScreen";
import BookingDetailsScreen from "../screens/bookings/BookingDetailsScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import RatingScreen from "../screens/rating/RatingScreen";
import SupportScreen from "../screens/settings/SupportScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerBackTitle: "Back", headerTintColor: "#086B64" }}>
      <Stack.Screen name="MainTabs" component={BottomNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} options={{ title: "Vehicle details" }} />
      <Stack.Screen name="BookingLocation" component={LocationScreen} options={{ title: "Pickup and drop-off" }} />
      <Stack.Screen name="BookingGoods" component={GoodsDetailsScreen} options={{ title: "Goods details" }} />
      <Stack.Screen name="BookingVehicle" component={VehicleSelectionScreen} options={{ title: "Choose a vehicle" }} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ title: "Review booking" }} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ title: "Booking created", headerBackVisible: false }} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ title: "Booking details" }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit profile" }} />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ title: "Rate delivery" }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Support and complaints" }} />
    </Stack.Navigator>
  );
}
