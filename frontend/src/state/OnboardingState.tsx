/**
 * First-run onboarding flags-whether the user has seen the welcome wizard
 * (phase 1) and the coach-marks tour (phase 2). Backed by AsyncStorage so each
 * shows exactly once **per account** (keys are namespaced by user id, so every
 * new sign-up on a shared device gets the full tour). `null` means the flags
 * haven't resolved yet-either storage is still loading or no account is
 * signed in-so callers must treat it as "don't show anything".
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppState } from './AppState';

const WIZARD_KEY = 'gymjam_tour_complete';
const TOUR_KEY = 'gymjam_coach_complete';

/** [wizardKey, tourKey] for one account. */
const keysFor = (userId: string) =>
  [`${WIZARD_KEY}:${userId}`, `${TOUR_KEY}:${userId}`] as const;

export interface OnboardingShape {
  /** null until AsyncStorage has been read. */
  hasSeenWizard: boolean | null;
  hasSeenTour: boolean | null;
  completeWizard: () => void;
  completeTour: () => void;
  /** Dev-only: clears both flags so the wizard + tour replay. */
  resetOnboarding: () => void;
}

const Ctx = createContext<OnboardingShape | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Must sit inside AppStateProvider: the flags belong to the signed-in
  // account, so we key everything off its user id.
  const { userId } = useAppState();
  const [hasSeenWizard, setHasSeenWizard] = useState<boolean | null>(null);
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);

  useEffect(() => {
    // Account changed (or hasn't loaded yet)-back to undecided so nothing
    // shows until this account's own flags are read.
    setHasSeenWizard(null);
    setHasSeenTour(null);
    if (!userId) return;

    let cancelled = false;
    const [wizardKey, tourKey] = keysFor(userId);
    AsyncStorage.multiGet([wizardKey, tourKey])
      .then((pairs) => {
        if (cancelled) return;
        const byKey = Object.fromEntries(pairs);
        setHasSeenWizard(byKey[wizardKey] === 'true');
        setHasSeenTour(byKey[tourKey] === 'true');
      })
      .catch(() => {
        if (cancelled) return;
        // Storage unavailable-claim "seen" so the tour can never loop forever.
        setHasSeenWizard(true);
        setHasSeenTour(true);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Writes are fire-and-forget (same best-effort pattern as lib/cache.ts):
  // state flips immediately so the UI dismisses without waiting on disk.
  const completeWizard = useCallback(() => {
    setHasSeenWizard(true);
    if (userId) AsyncStorage.setItem(keysFor(userId)[0], 'true').catch(() => { });
  }, [userId]);

  const completeTour = useCallback(() => {
    setHasSeenTour(true);
    if (userId) AsyncStorage.setItem(keysFor(userId)[1], 'true').catch(() => { });
  }, [userId]);

  const resetOnboarding = useCallback(() => {
    setHasSeenWizard(false);
    setHasSeenTour(false);
    if (userId) AsyncStorage.multiRemove([...keysFor(userId)]).catch(() => { });
  }, [userId]);

  const value = useMemo<OnboardingShape>(
    () => ({ hasSeenWizard, hasSeenTour, completeWizard, completeTour, resetOnboarding }),
    [hasSeenWizard, hasSeenTour, completeWizard, completeTour, resetOnboarding],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding(): OnboardingShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
