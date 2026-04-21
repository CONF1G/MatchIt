// src/app/(auth)/_layout.tsx
// Layout pentru toate ecranele de autentificare.
// Stack fără header — fiecare ecran are propriul header custom.

import { Stack } from "expo-router";
import { COLORS } from "../../config/theme";

/**
 * Provides the shared navigation layout for all authentication screens.
 *
 * The layout configures a Stack navigator with a consistent background color and
 * a fade-from-bottom transition, and registers the auth-related routes.
 *
 * @returns A Stack navigator containing the `login`, `register`, `forgot-password`, and `onboarding` screens.
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