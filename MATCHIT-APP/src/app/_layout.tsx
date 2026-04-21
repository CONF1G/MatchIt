import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../config/theme';

/**
 * Guards routes by redirecting users based on authentication state, profile onboarding status, and the current route segments.
 *
 * While auth state is loading, renders a full-screen centered activity indicator. Once loading completes, either redirects to the appropriate route
 * (login, onboarding, or main tabs) based on `user` and `profile`, or renders the matched route content.
 *
 * @returns The rendered node: an ActivityIndicator while authentication is loading, otherwise the matched route content via `<Slot />`.
 */
function AuthGuard() {
  const { user, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup   = segments[0] === '(auth)';
    const inGuestRoutes = segments[0] === 'guest';
    const inLobbyRoutes = segments[0] === 'lobby';

    if (!user) {
      // Guest and lobby routes are accessible without an account
      if (!inAuthGroup && !inGuestRoutes && !inLobbyRoutes) {
        router.replace('/(auth)/login');
      }
    } else if (inAuthGroup) {
      if (profile && !profile.onboarding_completed && segments[1] !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      } else if (!profile || profile.onboarding_completed) {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return <Slot />;
}

/**
 * App root layout that provides platform-safe area handling, sets the status bar style,
 * and mounts the authentication guard responsible for conditional route rendering.
 *
 * @returns The root layout element containing a `SafeAreaProvider`, a light `StatusBar`, and the `AuthGuard`.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard />
    </SafeAreaProvider>
  );
}
