/**
 * Liquid-glass surface — the app's shared "glass" material.
 *
 * Renders Apple's native Liquid Glass (expo-glass-effect / `GlassView`) on
 * iOS 26+, and a frosted blur (expo-blur / `BlurView`) fallback everywhere else
 * (Android, older iOS). Both run in Expo Go, so the glass theme works without a
 * development build.
 *
 * Use it as an absolutely-positioned background layer behind real content, e.g.
 *   <View style={[card, { borderColor }]}>
 *     <Glass radius={RADIUS.xl} style={StyleSheet.absoluteFill} />
 *     {children}
 *   </View>
 * That way `Glass` owns its own corner clipping (so the blur is rounded) while
 * the parent keeps `overflow: 'visible'` and is free to draw the border / cast
 * the shadow and let children overflow if they need to.
 *
 * `interactive` enables Liquid Glass's touch response — use it for buttons and
 * the slider thumb.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

// Resolve once at load: true only on iOS 26+. Everywhere else we blur-fallback.
const LIQUID = isLiquidGlassAvailable();

export function Glass({
  children,
  style,
  radius = 0,
  interactive = false,
  glassStyle = 'regular',
  tint = 'systemThickMaterialDark',
  intensity = 28,
  dim = 0.18,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius — clips the material so it matches the rounded surface. */
  radius?: number;
  /** Liquid Glass reacts to touch (buttons, the slider thumb). */
  interactive?: boolean;
  glassStyle?: 'regular' | 'clear';
  /** Blur-fallback tint (ignored on iOS 26 native glass). */
  tint?: BlurTint;
  /** Blur-fallback strength 1–100 (ignored on iOS 26 native glass). */
  intensity?: number;
  /** Blur-fallback darkening (0–1) layered over the blur for text legibility. */
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
      <BlurView tint={tint} intensity={intensity} style={StyleSheet.absoluteFill} />
      {dim > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(27,23,20,${dim})` }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The blur layer must be clipped to the rounded shape.
  clip: { overflow: 'hidden' },
});

/** True when the native iOS 26 Liquid Glass is in use (vs the blur fallback). */
export const isLiquidGlass = LIQUID;
