import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import {
  Onboarding, Home, CheckIn, PlanWeek, GroupView, NoGroup,
  GymBrowser, Leaderboard, PotTracker, Progress, GymSpace, ProfileView, SquadMapScreen, AppSettings,
  AccountSetup,
} from '../../src/screens';
import { useAppState } from '../../src/state/AppState';
import { useOnboarding } from '../../src/state/OnboardingState';
import { usePolling } from '../../src/ui/usePolling';
import { BlobBackground } from '../../src/ui/Blob';
import { CoachMarksOverlay, CoachMarksProvider, useCoachTarget, type CoachStep } from '../../src/ui/CoachMarks';
import { WizardOverlay } from '../../src/screens/onboarding/WizardOverlay';
import { C, FONT, RADIUS, SPACE } from '../../src/theme/tokens';

const EASE_OUT = Easing.out(Easing.cubic);

// The tab bar floats over the content (absolutely positioned) rather than
// taking a fixed row in the layout, so screen content shows continuously
// behind/around it. Screens reserve matching bottom space via TAB_BAR_CLEARANCE
// (see _shared) so the floating bar overlays content, not an empty dark band,
// and core actions still scroll clear of it.
const TAB_BAR_GAP = 14; // bar's gap from the bottom edge when there's no safe-area inset

/** Coach-marks tour, in order. The two home-* targets are registered inside
 * Home.tsx; the tab-* targets on the tab bar below. `screen` is the page each
 * step lives on — the overlay reports it so the tour walks the app, switching
 * the background page as it highlights each tab. */
const TOUR_STEPS: CoachStep[] = [
  { id: 'home-week', text: 'This is your week-tap a day to see your plan', screen: 'home' },
  { id: 'home-checkin', text: 'Hit this when you get to the gym', screen: 'home' },
  { id: 'tab-group', text: "See your group's pledges and nudge people who've gone quiet", screen: 'group' },
  { id: 'tab-progress', text: 'Your ELO score lives here-it goes up every time you show up', screen: 'progress' },
  { id: 'tab-profile', text: 'Your gym space, your squad on the map, and your settings', screen: 'profile' },
];

type Screen =
  | 'account-setup' | 'onboarding' | 'home' | 'check-in' | 'plan-week' | 'group'
  | 'gym-browser' | 'leaderboard' | 'pot-tracker' | 'progress' | 'gym-space'
  | 'profile' | 'squad-map' | 'settings';

export default function GymJamAppRoot() {
  // Coach-mark targets are registered from inside the shell (Home, the tab
  // bar), so the registry must wrap the whole app component.
  return (
    <CoachMarksProvider>
      <GymJamApp />
    </CoachMarksProvider>
  );
}

function GymJamApp() {
  const { ready, userId, gymId, groupId, tag, elo, refreshAll } = useAppState();
  const { hasSeenWizard, hasSeenTour, completeWizard, completeTour } = useOnboarding();
  const [screen, setScreen] = useState<Screen | null>(null);
  const insets = useSafeAreaInsets();

  // Where the floating bar sits above the bottom edge (clears the home indicator).
  const tabBarBottom = (insets.bottom || TAB_BAR_GAP);

  // Tab-bar coach-mark targets (Home registers its own two from inside).
  const groupTabTarget = useCoachTarget('tab-group');
  const progressTabTarget = useCoachTarget('tab-progress');
  const profileTabTarget = useCoachTarget('tab-profile');

  // Keep every device in sync-poll every 30 s and also refresh when the app
  // returns to the foreground (e.g. user switches back from another app).
  usePolling(refreshAll, 30000);

  useEffect(() => {
    if (!ready) return;
    // Wait until the account itself has loaded before deciding where to route.
    // Otherwise a warm launch (where `ready` flips true from the cache before
    // `me` is populated) would briefly see null tag/gym and wrongly show the
    // account-setup screen-and then get stuck there.
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
      case 'onboarding': return <Onboarding onDone={() => setScreen('gym-browser')} />;
      case 'home': return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
      case 'check-in': return <CheckIn onClose={() => setScreen('home')} />;
      case 'plan-week': return <PlanWeek onDone={() => setScreen('home')} onCancel={() => setScreen('home')} />;
      case 'group': return groupId
        ? <GroupView onBrowse={() => setScreen('gym-browser')} onLeaderboard={() => setScreen('leaderboard')} />
        : <NoGroup onBrowse={() => setScreen('gym-browser')} />;
      case 'gym-browser': return <GymBrowser onBack={() => setScreen(groupId ? 'group' : 'home')} onJoined={() => setScreen('home')} onCreated={() => setScreen('group')} />;
      case 'leaderboard': return <Leaderboard onBack={() => setScreen(groupId ? 'group' : 'home')} />;
      case 'pot-tracker': return <PotTracker onBack={() => setScreen('home')} />;
      case 'progress': return <Progress onGymSpace={() => setScreen('gym-space')} />;
      case 'gym-space': return <GymSpace onBack={() => setScreen('progress')} />;
      case 'profile': return <ProfileView onSettings={() => setScreen('settings')} onSquadMap={() => setScreen('squad-map')} />;
      case 'squad-map': return <SquadMapScreen onBack={() => setScreen('profile')} />;
      case 'settings': return <AppSettings onBack={() => setScreen('profile')} />;
      default: return <Home onCheckIn={() => setScreen('check-in')} onPlan={() => setScreen('plan-week')} onPot={() => setScreen('pot-tracker')} onGroup={() => setScreen('group')} />;
    }
  };

  const showTabs = screen !== 'account-setup' && screen !== 'onboarding' && screen !== 'check-in' && screen !== 'plan-week' && screen !== 'settings';
  // The squad map is a full-bleed map: no top safe-area inset (extends under the
  // status bar) and no ELO ribbon, so it reads like a real map app.
  const fullBleed = screen === 'squad-map';

  // First-run onboarding: the welcome wizard shows once the user is in the main
  // shell (post account-setup). When it finishes we route to Home (see its
  // onDone below), then the coach-mark tour runs — it drives its own navigation,
  // walking the pages as it highlights each tab, so it no longer needs to be
  // gated on the current screen. Both flags are null until AsyncStorage resolves,
  // which keeps everything hidden until we know.
  const showWizard = showTabs && hasSeenWizard === false;
  const showTour = !showWizard && hasSeenWizard === true && hasSeenTour === false;

  return (
    <View style={styles.fill}>
      <SafeAreaView style={styles.root} edges={fullBleed ? [] : ['top']}>
        {/* Persistent ELO bar-a fixed top header, part of the layout (not an
            overlay), so it stays put while the content below scrolls. */}
        {showTabs && !fullBleed && (
          <View style={styles.statHeader}>
            <View style={styles.statBadge}>
              <MaterialIcons name="emoji-events" size={13} color={C.accent} />
              <Text style={styles.statText}>{elo.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Content fills the full height and sits under the floating bar, so the
            bar overlays real content instead of an empty dark band. Screens
            reserve TAB_BAR_CLEARANCE at the bottom so nothing hides behind it. */}
        <View style={{ flex: 1 }}>{render()}</View>

        {showTabs && (
          <View style={[styles.tabBar, { bottom: tabBarBottom }]}>
            <Tab label="Home" icon="home" active={screen === 'home'} onPress={() => setScreen('home')} />
            <Tab label="Group" icon="group" active={['group', 'gym-browser', 'leaderboard', 'pot-tracker'].includes(screen)} onPress={() => setScreen('group')} targetRef={groupTabTarget} />
            <Tab label="Progress" icon="trending-up" active={['progress', 'gym-space'].includes(screen)} onPress={() => setScreen('progress')} targetRef={progressTabTarget} />
            <Tab label="Profile" icon="person" active={['profile', 'squad-map'].includes(screen)} onPress={() => setScreen('profile')} targetRef={profileTabTarget} />
          </View>
        )}
      </SafeAreaView>

      {/* First-run overlays sit outside the SafeAreaView so they cover the full
          window (status-bar area included). */}
      {/* Finishing the wizard lands on Home so the tour's first targets (the
          week + check-in, registered by Home) are mounted before it starts. */}
      {showWizard && <WizardOverlay onDone={() => { completeWizard(); setScreen('home'); }} />}
      {showTour && (
        <CoachMarksOverlay
          steps={TOUR_STEPS}
          // Walk the app: switch the background page to each step's screen.
          onStepChange={(s) => { if (s.screen) setScreen(s.screen as Screen); }}
          onDone={() => { completeTour(); setScreen('home'); }}
          onSkip={() => { completeTour(); setScreen('home'); }}
        />
      )}
    </View>
  );
}

function Tab({ label, icon, active, onPress, targetRef }: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  active: boolean;
  onPress: () => void;
  /** Coach-mark registration ref (see ui/CoachMarks). */
  targetRef?: (node: View | null) => void;
}) {
  return (
    <View style={styles.tab}>
      {/* Icons only — no text labels. The coach-mark target is the icon chip
          (not the full cell) so the tour spotlight is a neat rounded box that
          fits inside the floating bar instead of overflowing its edges. The
          label is kept for accessibility. */}
      <Pressable onPress={onPress} style={styles.tabInner} accessibilityRole="button" accessibilityLabel={label}>
        <View ref={targetRef} collapsable={false} style={[styles.tabIconWrap, active && styles.tabIconActive]}>
          <MaterialIcons name={icon} size={22} color={active ? C.primaryFg : C.mutedFg} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  splashCenter: { alignItems: 'center' },
  splashBrand: { fontFamily: FONT.extra, fontSize: 44, color: C.ink, letterSpacing: -1.2 },

  // Floating ELO badge-absolutely positioned so it overlays the top-right
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

  // Floating tab bar: detached from the bottom edge with side margins, rounded
  // corners and a shadow so it reads as an overlay. `bottom` is set inline from
  // the safe-area inset. Screens reserve `tabBarClearance` below their content
  // so nothing renders behind it.
  tabBar: {
    position: 'absolute',
    left: SPACE.lg,
    right: SPACE.lg,
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.borderHi,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tab: { flex: 1 },
  tabInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabIconWrap: { width: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: C.primary },
});
