import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppStateProvider } from '../src/state/AppState';
import { ToastProvider } from '../src/ui/toast';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // GymJam is a dark-themed app, so we always use the dark navigation theme
  // and a light status bar regardless of the device color scheme.
  return (
    <ToastProvider>
      <AppStateProvider>
        <ThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AppStateProvider>
    </ToastProvider>
  );
}