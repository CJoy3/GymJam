/**
 * Liquid-glass surface — the app's shared "glass" material.
 *
 * Renders Apple's native Liquid Glass (expo-glass-effect / `GlassView`) on
 * iOS 26+, and a translucent frosted panel fallback everywhere else (Android,
 * older iOS). Both run in Expo Go, so the glass theme works without a
 * development build.
 *
 * The fallback is a plain translucent `View` rather than a real blur: it keeps
 * the build free of any native-only dependency (the old expo-blur path pulled
 * `BlurView` from JitPack, which rate-limited release builds with 403s).
 *
 * Use it as an absolutely-positioned background layer behind real content, e.g.
 *   <View style={[card, { borderColor }]}>
 *     <Glass radius={RADIUS.xl} style={StyleSheet.absoluteFill} />
 *     {children}
 *   </View>
 * That way `Glass` owns its own corner clipping (so the panel is rounded) while
 * the parent keeps `overflow: 'visible'` and is free to draw the border / cast
 * the shadow and let children overflow if they need to.
 *
 * `interactive` enables Liquid Glass's touch response — use it for buttons and
 * the slider thumb.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// Resolve once at load: true only on iOS 26+. Everywhere else we fall back.
const LIQUID = isLiquidGlassAvailable();

export function Glass({
  children,
  style,
  radius = 0,
  interactive = false,
  glassStyle = 'regular',
  dim = 0.18,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius — clips the material so it matches the rounded surface. */
  radius?: number;
  /** Liquid Glass reacts to touch (buttons, the slider thumb). */
  interactive?: boolean;
  glassStyle?: 'regular' | 'clear';
  /** Fallback darkening (0–1) layered over the panel for text legibility. */
  dim?: number;
}) {
  const round = radius ? { borderRadius: radius } : undefined;

  if (LIQUID) {
    return (
      <GlassView
        style={[round, style]}
        glassEffectStyle={glassStyle}
        isInteractive={interactive}
        colorScheme="dark"
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.clip, round, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frost]} />
      {dim > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(27,23,20,${dim})` }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The fallback layers must be clipped to the rounded shape.
  clip: { overflow: 'hidden' },
  // Translucent frosted panel standing in for the blur on non-iOS-26 devices.
  frost: { backgroundColor: 'rgba(46,42,38,0.6)' },
});

/** True when the native iOS 26 Liquid Glass is in use (vs the blur fallback). */
export const isLiquidGlass = LIQUID;
