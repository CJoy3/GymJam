import React, { useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { C, RADIUS } from '../theme/tokens';

/**
 * Minimal dependency-free slider for integer ranges (e.g. £1–£20). Snaps to
 * whole steps as you drag or tap anywhere on the track. Built on PanResponder
 * so it needs no native slider module.
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
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const span = Math.max(1, max - min);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (raw: number) => clamp(Math.round(raw / step) * step);

  const valueFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return value;
    const ratio = Math.min(1, Math.max(0, x / w));
    return snap(min + ratio * span);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChangeRef.current(valueFromXRef.current(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChangeRef.current(valueFromXRef.current(e.nativeEvent.locationX)),
    }),
  ).current;

  // Keep the latest valueFromX reachable from the (stable) PanResponder closures.
  const valueFromXRef = useRef(valueFromX);
  valueFromXRef.current = valueFromX;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const pct = width > 0 ? ((clamp(value) - min) / span) : 0;
  const thumbLeft = Math.max(0, Math.min(width - THUMB, pct * width - THUMB / 2));

  return (
    <View style={{ paddingVertical: 14 }} {...responder.panHandlers}>
      <View onLayout={onLayout} style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

const THUMB = 26;

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
    top: -10,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: C.ink,
    borderWidth: 3,
    borderColor: C.bg,
  },
};
