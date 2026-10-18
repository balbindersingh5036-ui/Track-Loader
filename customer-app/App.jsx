import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider } from "./src/store/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof MutationObserver !== "undefined") {
      // Prevent 'Blocked aria-hidden on an element because its descendant retained focus' warning
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "aria-hidden" &&
            mutation.target instanceof HTMLElement &&
            mutation.target.getAttribute("aria-hidden") === "true"
          ) {
            const active = document.activeElement;
            if (active && mutation.target.contains(active) && typeof active.blur === "function") {
              active.blur();
            }
          }
        });
      });

      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ["aria-hidden"]
      });

      return () => observer.disconnect();
    }
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
