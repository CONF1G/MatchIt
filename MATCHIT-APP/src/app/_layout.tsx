import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../config/theme';

/**
 * Guards app routes based on authentication and onboarding state, performing redirects when appropriate and displaying a loading indicator while auth state is pending.
 *
 * - Unauthenticated users are redirected to the login route unless the current route is within the auth, guest, or lobby groups.
 * - Authenticated users visiting auth routes are redirected to onboarding if their profile exists and onboarding is incomplete; otherwise they are redirected to the main tabs.
 *
 * @returns The component tree: a centered loading indicator while auth state is loading, otherwise the active route `<Slot />`.
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
 * Root application layout that provides safe-area handling, configures the status bar, and mounts the authentication guard.
 *
 * @returns The top-level layout element wrapping the app with `SafeAreaProvider`, a light `StatusBar`, and the `AuthGuard` component.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard />
    </SafeAreaProvider>
  );
}
