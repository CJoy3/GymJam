import { useEffect, useState } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';

import { ensureSupabase } from '../lib/supabase';
import { AppStateProvider } from '../src/state/AppState';
import { OnboardingProvider } from '../src/state/OnboardingState';
import { ToastProvider } from '../src/ui/toast';
import { LoginScreen } from '../src/screens/Login';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // undefined = still checking; null = no session; Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    ensureSupabase().then((sb) => {
      sb.auth.getSession().then(({ data }) => {
        setSession(data.session ?? null);
      });
      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, sess) => {
        setSession(sess ?? null);
      });
      unsub = () => subscription.unsubscribe();
    }).catch(() => {
      setSession(null);
    });
    return () => { unsub?.(); };
  }, []);

  const ready = fontsLoaded && session !== undefined;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (!session) {
    return (
      <ToastProvider>
        <ThemeProvider value={DarkTheme}>
          <LoginScreen />
          <StatusBar style="light" />
        </ThemeProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppStateProvider>
        <OnboardingProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </OnboardingProvider>
      </AppStateProvider>
    </ToastProvider>
  );
}
