import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Onboarding, Home, CheckIn, PlanWeek, GroupView, NoGroup,
  GymBrowser, PotTracker, Progress, GymSpace,
} from '../../src/screens/Screens';
import { useAppState } from '../../src/state/AppState';
import { C } from '../../src/theme/tokens';

type Screen =
  | 'onboarding' | 'home' | 'check-in' | 'plan-week' | 'group'
  | 'gym-browser' | 'pot-tracker' | 'progress' | 'gym-space';

export default function GymJamApp() {
  const { groupName } = useAppState();
  const [screen, setScreen] = useState<Screen>('onboarding');

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
        return groupName
          ? <GroupView onBrowse={() => setScreen('gym-browser')} />
          : <NoGroup onBrowse={() => setScreen('gym-browser')} />;
      case 'gym-browser':
        return <GymBrowser onBack={() => setScreen('group')} onJoined={() => setScreen('group')} />;
      case 'pot-tracker':
        return <PotTracker onBack={() => setScreen('home')} />;
      case 'progress':
        return <Progress onGymSpace={() => setScreen('gym-space')} />;
      case 'gym-space':
        return <GymSpace onBack={() => setScreen('progress')} />;
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
        </View>
      )}
    </SafeAreaView>
  );
}

import { Pressable, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, height: 64, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIndicator: { position: 'absolute', bottom: 0, width: 40, height: 3, borderRadius: 2, backgroundColor: C.primary },
});
