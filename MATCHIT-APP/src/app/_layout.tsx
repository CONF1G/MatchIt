import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../config/theme';

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGuard />
    </SafeAreaProvider>
  );
}
