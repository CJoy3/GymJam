import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Onboarding, Home, CheckIn, PlanWeek, GroupView, NoGroup,
  GymBrowser, PotTracker, Progress, GymSpace,
} from '../../src/screens/Screens';
import { ProfileView } from '../../src/screens/ProfileScreen';
import { useAppState } from '../../src/state/AppState';
import { C } from '../../src/theme/tokens';

type Screen =
  | 'onboarding' | 'home' | 'check-in' | 'plan-week' | 'group'
  | 'gym-browser' | 'pot-tracker' | 'progress' | 'gym-space' | 'profile';

export default function GymJamApp() {
  const { ready, gymId, groupId } = useAppState();
  const [screen, setScreen] = useState<Screen | null>(null);

  // Pick the initial screen once user state is loaded.
  useEffect(() => {
    if (!ready || screen !== null) return;
    if (!gymId) setScreen('onboarding');
    else if (!groupId) setScreen('gym-browser');
    else setScreen('home');
  }, [ready, gymId, groupId, screen]);

  if (!ready || screen === null) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <ActivityIndicator color={C.primary} />
        <Text style={styles.splashTxt}>Loading GymJam…</Text>
      </SafeAreaView>
    );
  }

  const render = () => {
    switch (screen) {
      case 'onboarding':
        return <Onboarding onDone={() => setScreen('gym-browser')} />;
      case 'home':
        return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} />;
      case 'check-in':
        return <CheckIn onClose={() => setScreen('home')} />;
      case 'plan-week':
        return <PlanWeek onDone={() => setScreen('home')} onCancel={() => setScreen('home')} />;
      case 'group':
        return groupId
          ? <GroupView onBrowse={() => setScreen('gym-browser')} />
          : <NoGroup onBrowse={() => setScreen('gym-browser')} />;
      case 'gym-browser':
        return <GymBrowser onBack={() => setScreen(groupId ? 'group' : 'home')} onJoined={() => setScreen('home')} />;
      case 'pot-tracker':
        return <PotTracker onBack={() => setScreen('home')} />;
      case 'progress':
        return <Progress onGymSpace={() => setScreen('gym-space')} />;
      case 'gym-space':
        return <GymSpace onBack={() => setScreen('progress')} />;
      case 'profile':
        return <ProfileView onBrowse={() => setScreen('gym-browser')} />;
      default:
        return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} />;
    }
  };

  const showTabs = screen !== 'onboarding' && screen !== 'check-in';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ flex: 1 }}>{render()}</View>
      {showTabs && (
        <View style={styles.tabBar}>
          <Tab label="Home" icon="home" active={screen === 'home'} onPress={() => setScreen('home')} />
          <Tab label="Group" icon="group" active={['group', 'gym-browser'].includes(screen)} onPress={() => setScreen('group')} />
          <Tab label="Progress" icon="trending-up" active={['progress', 'gym-space'].includes(screen)} onPress={() => setScreen('progress')} />
          <Tab label="Profile" icon="person" active={screen === 'profile'} onPress={() => setScreen('profile')} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Tab({ label, icon, active, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <MaterialIcons name={icon} size={24} color={active ? C.ink : C.mutedFg} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? C.ink : C.mutedFg }}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  splashTxt: { color: C.mutedFg, fontSize: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, height: 64, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIndicator: { position: 'absolute', bottom: 0, width: 40, height: 3, borderRadius: 2, backgroundColor: C.primary },
});
