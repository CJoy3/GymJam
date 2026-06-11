/**
 * Hand-rolled coach-marks ("spotlight tour")-no external tour library.
 *
 * Pieces:
 *  - `CoachMarksProvider` + `useCoachTarget(id)`: a ref registry. Any component
 *    marks a View as a tour target (`<View ref={useCoachTarget('home-week')}
 *    collapsable={false}>`) without prop-drilling through the screen switch.
 *  - `CoachMarksOverlay`: given ordered steps, measures the current target with
 *    measureInWindow(), dims everything except a rounded cutout around it (SVG
 *    mask), and shows a cream tooltip card with Next / Skip. The tooltip sits
 *    below the target when it's in the upper half of the screen, above when not.
 *
 * Targets that never become measurable (unmounted, zero-size) are skipped after
 * a short retry window rather than spotlighting nothing.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode,
} from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Body, Btn, Card } from './components';

export interface CoachStep {
  id: string;
  text: string;
  /** App screen this step lives on. The overlay reports it via onStepChange so
   * the host can switch the background page to follow the tour. */
  screen?: string;
}

type TargetRect = { x: number; y: number; w: number; h: number };

interface Registry {
  register: (id: string, node: View | null) => void;
  getTarget: (id: string) => View | null;
}

const Ctx = createContext<Registry | null>(null);

export function CoachMarksProvider({ children }: { children: ReactNode }) {
  const targets = useRef(new Map<string, View>());
  const value = useMemo<Registry>(() => ({
    register: (id, node) => {
      if (node) targets.current.set(id, node);
      else targets.current.delete(id);
    },
    getTarget: (id) => targets.current.get(id) ?? null,
  }), []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Callback ref that registers a View as a coach-mark target. Pair it with
 * `collapsable={false}` so Android keeps the native view measurable. Safe to
 * call outside the provider (no-op). */
export function useCoachTarget(id: string): (node: View | null) => void {
  const ctx = useContext(Ctx);
  return useCallback((node: View | null) => { ctx?.register(id, node); }, [ctx, id]);
}

const SPOT_PAD = SPACE.sm;   // breathing room around the highlighted element
const MEASURE_RETRIES = 20;  // ~1s before an unmeasurable step is skipped
const RETRY_MS = 50;
// Dim + on-cream text tones derived from C.bg / C.primaryFg-the same rgba
// treatment the cream cards use elsewhere (see styles.eyebrowOnCream).
const DIM = 'rgba(27,23,20,0.78)';
const ON_CREAM_SOFT = 'rgba(27,23,20,0.55)';

export function CoachMarksOverlay({
  steps, onDone, onSkip, onStepChange,
}: {
  steps: CoachStep[];
  onDone: () => void;
  onSkip: () => void;
  /** Fired whenever the active step changes (incl. on mount) so the host can
   * navigate the background to the step's screen, making the tour walk pages. */
  onStepChange?: (step: CoachStep, index: number) => void;
}) {
  const registry = useContext(Ctx);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tipH, setTipH] = useState(0);
  const rootRef = useRef<View>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Tell the host which screen this step belongs to, so it can switch the
  // background page *before* we measure the step's target. Tab targets live in
  // the always-present floating bar, so they stay measurable across pages.
  useEffect(() => {
    if (step) onStepChange?.(step, index);
    // Only re-run when the step changes; onStepChange is stable from the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const goNext = useCallback(() => {
    // Deliberately keep the current spotlight + tooltip on screen while the
    // next target measures-clearing them caused a visible blank-dim hiccup
    // between steps. The new rect lands a frame or two later and the spotlight
    // jumps straight to it.
    if (index >= steps.length - 1) onDone();
    else setIndex(index + 1);
  }, [index, steps.length, onDone]);

  // Measure the current step's target: window coords from measureInWindow,
  // converted to overlay-local coords by subtracting the overlay's own origin
  // (keeps the spotlight correct regardless of safe-area insets).
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const retryOrSkip = () => {
      tries += 1;
      if (tries >= MEASURE_RETRIES) {
        if (!cancelled) goNext(); // target never appeared-skip the step
      } else {
        setTimeout(attempt, RETRY_MS);
      }
    };
    const attempt = () => {
      if (cancelled) return;
      const node = step ? registry?.getTarget(step.id) : null;
      if (!node) { retryOrSkip(); return; }
      node.measureInWindow((x, y, w, h) => {
        if (cancelled) return;
        if (!(w > 0 && h > 0)) { retryOrSkip(); return; }
        rootRef.current?.measureInWindow((rx, ry) => {
          if (cancelled) return;
          setRect({ x: x - rx, y: y - ry, w, h });
        });
      });
    };
    attempt();
    return () => { cancelled = true; };
  }, [registry, step, goNext]);

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const cutout = rect && {
    x: rect.x - SPOT_PAD,
    y: rect.y - SPOT_PAD,
    w: rect.w + SPOT_PAD * 2,
    h: rect.h + SPOT_PAD * 2,
  };

  const below = rect ? rect.y + rect.h / 2 < size.h / 2 : true;
  const tipTop = cutout
    ? below
      ? Math.min(cutout.y + cutout.h + SPACE.md, Math.max(SPACE.md, size.h - tipH - SPACE.md))
      : Math.max(SPACE.md, cutout.y - SPACE.md - tipH)
    : 0;

  return (
    <View ref={rootRef} style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* Swallow every touch so the app underneath is inert during the tour. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { }} accessible={false} />

      {cutout && size.w > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size.w} height={size.h}>
            <Defs>
              <Mask id="coach-spotlight">
                <Rect x={0} y={0} width={size.w} height={size.h} fill="#FFFFFF" />
                <Rect x={cutout.x} y={cutout.y} width={cutout.w} height={cutout.h} rx={RADIUS.md} fill="#000000" />
              </Mask>
            </Defs>
            <Rect x={0} y={0} width={size.w} height={size.h} fill={DIM} mask="url(#coach-spotlight)" />
            <Rect x={cutout.x} y={cutout.y} width={cutout.w} height={cutout.h} rx={RADIUS.md} stroke={C.accent} strokeWidth={1.5} fill="none" />
          </Svg>
        </View>
      )}

      {cutout && size.h > 0 && step && (
        <View
          onLayout={(e) => setTipH(e.nativeEvent.layout.height)}
          // Invisible on the first pass so above-target placement can use the
          // measured tooltip height without a visible jump.
          style={[s.tip, { top: tipTop, opacity: tipH > 0 ? 1 : 0 }]}
        >
          <Card tone="cream" padding={SPACE.lg}>
            <Text style={s.counter}>{index + 1} of {steps.length}</Text>
            <Body style={s.tipText}>{step.text}</Body>
            <View style={s.tipRow}>
              <Pressable onPress={onSkip} hitSlop={10}>
                <Text style={s.skip}>Skip tour</Text>
              </Pressable>
              <Btn label={isLast ? 'Done' : 'Next'} size="md" variant="inverse" onPress={goNext} />
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tip: { position: 'absolute', left: SPACE.xl, right: SPACE.xl },
  counter: { fontFamily: FONT.bold, fontSize: 11, color: ON_CREAM_SOFT, letterSpacing: 0.8, textTransform: 'uppercase' },
  tipText: { color: C.primaryFg, marginTop: 6 },
  tipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.lg },
  skip: { fontFamily: FONT.semibold, fontSize: 13, color: ON_CREAM_SOFT },
});
