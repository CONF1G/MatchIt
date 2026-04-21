// src/app/(auth)/_layout.tsx
// Layout pentru toate ecranele de autentificare.
// Stack fără header — fiecare ecran are propriul header custom.

import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Provides the shared navigation layout for authentication-related screens.
 *
 * @returns A configured Stack layout with the header hidden, the background set to `COLORS.bg`, a "fade_from_bottom" animation, and registered screens: `login`, `register`, `forgot-password`, and `onboarding`.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation:    "fade_from_bottom",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}