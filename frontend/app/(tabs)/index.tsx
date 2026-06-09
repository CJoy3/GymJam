import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import {
  Onboarding, Home, CheckIn, PlanWeek, GroupView, NoGroup,
  GymBrowser, Leaderboard, PotTracker, Progress, GymSpace, ProfileView, SquadMapScreen, AppSettings,
  AccountSetup,
} from '../../src/screens';
import { useAppState } from '../../src/state/AppState';
import { usePolling } from '../../src/ui/usePolling';
import { BlobBackground } from '../../src/ui/Blob';
import { C, FONT, RADIUS, SPACE } from '../../src/theme/tokens';

const EASE_OUT = Easing.out(Easing.cubic);

type Screen =
  | 'account-setup' | 'onboarding' | 'home' | 'check-in' | 'plan-week' | 'group'
  | 'gym-browser' | 'leaderboard' | 'pot-tracker' | 'progress' | 'gym-space'
  | 'profile' | 'squad-map' | 'settings';

export default function GymJamApp() {
  const { ready, userId, gymId, groupId, tag, elo, refreshAll } = useAppState();
  const [screen, setScreen] = useState<Screen | null>(null);

  // Keep every device in sync — poll every 30 s and also refresh when the app
  // returns to the foreground (e.g. user switches back from another app).
  usePolling(refreshAll, 30000);

  useEffect(() => {
    if (!ready) return;
    // Wait until the account itself has loaded before deciding where to route.
    // Otherwise a warm launch (where `ready` flips true from the cache before
    // `me` is populated) would briefly see null tag/gym and wrongly show the
    // account-setup screen — and then get stuck there.
    if (!userId) return;

    const setUp = !!tag && !!gymId;
    if (!setUp) {
      // Genuinely needs to pick a tag + home gym.
      if (screen !== 'account-setup') setScreen('account-setup');
      return;
    }

    // Set up: route in from the splash or off any setup screen. Leave the user
    // wherever they are once they're inside the app.
    if (screen === null || screen === 'account-setup' || screen === 'onboarding') {
      setScreen(groupId ? 'home' : 'gym-browser');
    }
  }, [ready, userId, gymId, groupId, tag, screen]);

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
      case 'account-setup': return <AccountSetup onDone={() => setScreen('gym-browser')} />;
      case 'onboarding':   return <Onboarding onDone={() => setScreen('gym-browser')} />;
      case 'home':         return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
      case 'check-in':     return <CheckIn onClose={() => setScreen('home')} />;
      case 'plan-week':    return <PlanWeek onDone={() => setScreen('home')} onCancel={() => setScreen('home')} />;
      case 'group':        return groupId
                              ? <GroupView onBrowse={() => setScreen('gym-browser')} onLeaderboard={() => setScreen('leaderboard')} />
                              : <NoGroup onBrowse={() => setScreen('gym-browser')} />;
      case 'gym-browser':  return <GymBrowser onBack={() => setScreen(groupId ? 'group' : 'home')} onJoined={() => setScreen('home')} onCreated={() => setScreen('group')} />;
      case 'leaderboard':  return <Leaderboard onBack={() => setScreen(groupId ? 'group' : 'home')} />;
      case 'pot-tracker':  return <PotTracker onBack={() => setScreen('home')} />;
      case 'progress':     return <Progress onGymSpace={() => setScreen('gym-space')} />;
      case 'gym-space':    return <GymSpace onBack={() => setScreen('progress')} />;
      case 'profile':      return <ProfileView onSettings={() => setScreen('settings')} onSquadMap={() => setScreen('squad-map')} />;
      case 'squad-map':    return <SquadMapScreen onBack={() => setScreen('profile')} />;
      case 'settings':     return <AppSettings onBack={() => setScreen('profile')} />;
      default:             return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
    }
  };

  const showTabs = screen !== 'account-setup' && screen !== 'onboarding' && screen !== 'check-in' && screen !== 'plan-week' && screen !== 'settings';
  // The squad map is a full-bleed map: no top safe-area inset (extends under the
  // status bar) and no ELO ribbon, so it reads like a real map app.
  const fullBleed = screen === 'squad-map';

  return (
    <SafeAreaView style={styles.root} edges={fullBleed ? [] : ['top']}>
      {/* Persistent ELO bar — a fixed top header, part of the layout (not an
          overlay), so it stays put while the content below scrolls. */}
      {showTabs && !fullBleed && (
        <View style={styles.statHeader}>
          <View style={styles.statBadge}>
            <MaterialIcons name="emoji-events" size={13} color={C.accent} />
            <Text style={styles.statText}>{elo.toLocaleString()}</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }}>{render()}</View>

      {showTabs && (
        <View style={styles.tabBar}>
          <Tab label="Home"     icon="home"          active={screen === 'home'} onPress={() => setScreen('home')} />
          <Tab label="Group"    icon="group"         active={['group', 'gym-browser', 'leaderboard', 'pot-tracker'].includes(screen)} onPress={() => setScreen('group')} />
          <Tab label="Progress" icon="trending-up"   active={['progress', 'gym-space'].includes(screen)} onPress={() => setScreen('progress')} />
          <Tab label="Profile"  icon="person"        active={['profile', 'squad-map'].includes(screen)} onPress={() => setScreen('profile')} />
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

  // Floating ELO badge — absolutely positioned so it overlays the top-right
  // corner without adding any vertical buffer to the screen, and stays put
  // while content scrolls underneath.
  statHeader: {
    position: 'absolute',
    // Aligned with each screen's header row (the eyebrow / "Hi, name" line,
    // which sits at pageWrap.paddingTop = 56).
    top: 50,
    right: SPACE.xl,
    zIndex: 10,
  },
  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.borderHi,
  },
  statText: { fontFamily: FONT.semibold, fontSize: 13, color: C.ink },

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
