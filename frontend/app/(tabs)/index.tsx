import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import {
  Onboarding, Home, CheckIn, PlanWeek, GroupView, NoGroup,
  GymBrowser, PotTracker, Progress, GymSpace, ProfileView,
} from '../../src/screens';
import { useAppState } from '../../src/state/AppState';
import { BlobBackground } from '../../src/ui/Blob';
import { C, FONT } from '../../src/theme/tokens';

const EASE_OUT = Easing.out(Easing.cubic);

type Screen =
  | 'onboarding' | 'home' | 'check-in' | 'plan-week' | 'group'
  | 'gym-browser' | 'pot-tracker' | 'progress' | 'gym-space' | 'profile';

export default function GymJamApp() {
  const { ready, gymId, groupId } = useAppState();
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    if (!ready || screen !== null) return;
    if (!gymId) setScreen('onboarding');
    else if (!groupId) setScreen('gym-browser');
    else setScreen('home');
  }, [ready, gymId, groupId, screen]);

  if (!ready || screen === null) {
    return (
      <View style={styles.splash}>
        <BlobBackground variant="celebrate" />
        <Animated.View entering={FadeIn.duration(420).easing(EASE_OUT)} style={styles.splashCenter}>
          <Text style={styles.splashBrand}>GymJam</Text>
          <ActivityIndicator color={C.ink} style={{ marginTop: 22 }} />
        </Animated.View>
      </View>
    );
  }

  const render = () => {
    switch (screen) {
      case 'onboarding':   return <Onboarding onDone={() => setScreen('gym-browser')} />;
      case 'home':         return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
      case 'check-in':     return <CheckIn onClose={() => setScreen('home')} />;
      case 'plan-week':    return <PlanWeek onDone={() => setScreen('home')} onCancel={() => setScreen('home')} />;
      case 'group':        return groupId
                              ? <GroupView onBrowse={() => setScreen('gym-browser')} />
                              : <NoGroup onBrowse={() => setScreen('gym-browser')} />;
      case 'gym-browser':  return <GymBrowser onBack={() => setScreen(groupId ? 'group' : 'home')} onJoined={() => setScreen('home')} onCreated={() => setScreen('group')} />;
      case 'pot-tracker':  return <PotTracker onBack={() => setScreen('home')} />;
      case 'progress':     return <Progress onGymSpace={() => setScreen('gym-space')} />;
      case 'gym-space':    return <GymSpace onBack={() => setScreen('progress')} />;
      case 'profile':      return <ProfileView />;
      default:             return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
    }
  };

  const showTabs = screen !== 'onboarding' && screen !== 'check-in' && screen !== 'plan-week';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ flex: 1 }}>{render()}</View>
      {showTabs && (
        <View style={styles.tabBar}>
          <Tab label="Home"     icon="home"          active={screen === 'home'} onPress={() => setScreen('home')} />
          <Tab label="Group"    icon="group"         active={['group', 'gym-browser', 'pot-tracker'].includes(screen)} onPress={() => setScreen('group')} />
          <Tab label="Progress" icon="trending-up"   active={['progress', 'gym-space'].includes(screen)} onPress={() => setScreen('progress')} />
          <Tab label="Profile"  icon="person"        active={screen === 'profile'} onPress={() => setScreen('profile')} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Tab({ label, icon, active, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <View style={[styles.tabIconWrap, active && styles.tabIconActive]}>
        <MaterialIcons name={icon} size={22} color={active ? C.primaryFg : C.mutedFg} />
      </View>
      <Text style={[styles.tabLabel, { color: active ? C.ink : C.mutedFg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  splashCenter: { alignItems: 'center' },
  splashBrand: { fontFamily: FONT.extra, fontSize: 44, color: C.ink, letterSpacing: -1.2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.bgSoft,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabIconWrap: { width: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: C.primary },
  tabLabel: { fontFamily: FONT.medium, fontSize: 10.5, letterSpacing: 0.3 },
});
