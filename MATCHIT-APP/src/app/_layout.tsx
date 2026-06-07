import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { COLORS } from '../config/theme';

// Parse both query params (?key=val) and hash fragments (#key=val) from a URL.
function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryPart = url.includes('?') ? url.split('?')[1] : '';
  const hashPart  = url.includes('#') ? url.split('#')[1] : '';
  for (const part of [queryPart, hashPart]) {
    if (!part) continue;
    for (const pair of part.split('&')) {
      const [k, v] = pair.split('=');
      if (k && v) params[k] = decodeURIComponent(v);
    }
  }
  return params;
}

function AuthGuard() {
  const { user, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // ── Deep-link handler: feeds the recovery token to Supabase on native ────────
  // detectSessionInUrl is false on native, so we must do this manually.
  // Handles both PKCE (?code=…) and implicit (#access_token=…&type=recovery).
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes('reset-password')) return;
      const params = parseUrlParams(url);

      if (params.code) {
        // PKCE flow — exchange code for session; Supabase fires PASSWORD_RECOVERY
        await supabase.auth.exchangeCodeForSession(params.code);
      } else if (params.access_token && params.type === 'recovery') {
        // Implicit flow — restore session manually, then navigate
        await supabase.auth.setSession({
          access_token:  params.access_token,
          refresh_token: params.refresh_token ?? '',
        });
        router.replace('/(auth)/reset-password' as any);
      }
    };

    // App was closed and opened via the link
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    // App was in background and brought to foreground via the link
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // PASSWORD_RECOVERY fires after exchangeCodeForSession succeeds (PKCE path).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password' as any);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
      // Allow reset-password for both email-link recovery and profile-initiated changes
      if (segments[1] === 'reset-password') return;
      if (profile && !profile.onboarding_completed && segments[1] !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      } else if (profile?.onboarding_completed) {
        router.replace('/(tabs)');
      }
      // profile still loading (null) → stay put and wait
    }
  }, [user, loading, profile, segments]);

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
