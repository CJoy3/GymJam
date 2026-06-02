import { Tabs } from 'expo-router';
import React from 'react';

// GymJam renders its own in-app tab bar inside the index screen,
// so the Expo Router tab bar is hidden here.
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
