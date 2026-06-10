import React, { useRef, useState } from 'react';
import { PanResponder, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { C, RADIUS } from '../theme/tokens';

/**
 * Minimal dependency-free slider for integer ranges (e.g. £1–£20). Snaps to
 * whole steps as you drag or tap anywhere on the track. Built on PanResponder
 * so it needs no native slider module.
 *
 * Dragging maps the touch's *absolute* screen X (gestureState.moveX) against the
 * track's measured window position — not `locationX`, which is relative to
 * whichever child view (thumb/fill) the finger is over and makes the value jump.
 */
export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  // Track geometry in window coords, refreshed on each gesture so scrolling /
  // layout shifts can't desync the mapping.
  const geom = useRef({ x: 0, width: 0 });
  const trackRef = useRef<View>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const span = Math.max(1, max - min);
  const cfgRef = useRef({ min, max, step, span });
  cfgRef.current = { min, max, step, span };

  // Apply an absolute screen X to the slider, snapping to the nearest step.
  // Only fires onChange when the snapped value actually changes (avoids redundant
  // re-renders that make the drag feel choppy).
  const applyAbsX = (absX: number) => {
    const g = geom.current;
    const { min: lo, max: hi, step: st, span: sp } = cfgRef.current;
    if (g.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (absX - g.x) / g.width));
    const next = Math.min(hi, Math.max(lo, Math.round((lo + ratio * sp) / st) * st));
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChangeRef.current(next);
    }
  };

  const measureThen = (cb: () => void) => {
    if (trackRef.current) {
      trackRef.current.measureInWindow((x, _y, w) => {
        geom.current = { x, width: w };
        cb();
      });
    } else {
      cb();
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
        measureThen(() => applyAbsX(gs.x0)),
      onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
        applyAbsX(gs.moveX),
    }),
  ).current;

  const onLayout = () => {
    if (trackRef.current) {
      trackRef.current.measureInWindow((x, _y, w) => {
        geom.current = { x, width: w };
        if (w !== width) setWidth(w);
      });
    }
  };

  const pct = span > 0 ? (Math.min(max, Math.max(min, value)) - min) / span : 0;
  const thumbLeft = Math.max(0, Math.min(width - THUMB, pct * width - THUMB / 2));

  return (
    <View style={{ paddingVertical: 16 }} {...responder.panHandlers}>
      <View ref={trackRef} onLayout={onLayout} style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        {width > 0 && <View style={[styles.thumb, { left: thumbLeft }]} />}
      </View>
    </View>
  );
}

const THUMB = 28;

const styles = {
  track: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: C.muted,
    justifyContent: 'center' as const,
  },
  fill: {
    position: 'absolute' as const,
    left: 0,
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: C.accent,
  },
  thumb: {
    position: 'absolute' as const,
    top: -11,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: C.ink,
    borderWidth: 3,
    borderColor: C.bg,
  },
};
