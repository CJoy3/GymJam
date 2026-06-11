/**
 * First-run welcome wizard — a full-screen overlay that sits above the app
 * shell (the shell stays mounted underneath). Four steps introducing pledges,
 * groups, and the gym space; finishing or skipping marks the wizard seen via
 * the onboarding state (AsyncStorage-backed), so it never re-shows.
 */
import React, { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../../theme/tokens';
import { FadeInItem } from '../../ui/components';
import { BlobBackground } from '../../ui/Blob';
import { DayPicker } from '../../ui/DayPicker';
import { GymScene } from '../../gymspace';
import { DAYS, DayStatus } from '../../state/types';
import { WizardStep } from './WizardStep';

// Read-only demo pledge for the illustration: Mon / Wed / Fri planned.
const DEMO_PLEDGE: DayStatus[] = DAYS.map((day, i) => ({
  day,
  state: i === 0 || i === 2 || i === 4 ? 'planned' : 'unselected',
}));
const EMPTY_ROOM = new Set<string>();

interface StepDef {
  eyebrow: string;
  title: string;
  body: string;
  illustration: ReactNode;
  skippable: boolean;
}

const STEPS: StepDef[] = [
  {
    eyebrow: 'Welcome',
    title: 'Welcome to GymJam',
    body: 'GymJam keeps you accountable through your group: pledge your gym days, then actually show up. Every session you make earns ELO and climbs your rank.',
    illustration: null,
    skippable: false,
  },
  {
    eyebrow: 'Your pledge',
    title: 'Make a pledge each week',
    body: "Every Sunday you lock in which days you'll hit the gym that week. Your group can see your pledge — and whether you keep it.",
    illustration: <DayPicker days={DEMO_PLEDGE} />,
    skippable: true,
  },
  {
    eyebrow: 'Your group',
    title: 'Your group keeps you honest',
    body: "Group members see each other's attendance and can nudge anyone who goes quiet. You all share a weekly pot — missed pledges feed it.",
    illustration: null,
    skippable: true,
  },
  {
    eyebrow: 'Your gym space',
    title: 'Build your gym space',
    body: 'As your ELO grows you unlock equipment and decor for your own pixel gym. Keep showing up and watch it fill out.',
    illustration: <GymScene elo={0} placedItemIds={EMPTY_ROOM} />,
    skippable: true,
  },
];

export function WizardOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={[StyleSheet.absoluteFill, s.root]}>
      {/* Claim every touch so nothing leaks through to the shell underneath. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />
      <BlobBackground variant="celebrate" />
      <SafeAreaView edges={['top', 'bottom']} style={s.fill}>
        {/* Keyed so each step re-runs the entrance fade. */}
        <FadeInItem key={step} style={s.fill}>
          <WizardStep
            eyebrow={cur.eyebrow}
            title={cur.title}
            body={cur.body}
            illustration={cur.illustration}
            primaryLabel={isLast ? "Let's go" : 'Continue'}
            onPrimary={isLast ? onDone : () => setStep((p) => p + 1)}
            onSkip={cur.skippable ? onDone : undefined}
            step={step}
            total={STEPS.length}
          />
        </FadeInItem>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: C.bg },
  fill: { flex: 1 },
});
