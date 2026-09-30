import React from "react";
import { useAuth } from "../store/AuthContext";
import AppNavigator from "./AppNavigator";
import AuthNavigator from "./AuthNavigator";
import SplashScreen from "../screens/splash/SplashScreen";

export default function RootNavigator() {
  const { user, ready, restoreError, retryRestore } = useAuth();

  if (!ready) return <SplashScreen />;
  if (restoreError) return <SplashScreen error={restoreError} onRetry={retryRestore} />;
  return user ? <AppNavigator /> : <AuthNavigator />;
}
