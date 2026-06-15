import React, { useId } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

/**
 * Atmospheric background glows-soft warm light behind the content layer.
 *
 * These are true radial gradients (hue at the centre fading to fully
 * transparent at the edge), not flat-filled circles, so they read as ambient
 * light rather than hard discs. Variants tint different corners by mood.
 */

// Glow hues (solid; the gradient's stop-opacity does the fading).
const PEACH = 'rgb(232,155,124)';
const SAGE = 'rgb(156,181,143)';
const CREAM = 'rgb(242,229,210)';

/** A single soft radial glow, absolutely positioned via `pos`. `size` is the
 * box it fills; the gradient fades to transparent at 50% radius. */
function Glow({
  size, color, opacity, pos,
}: {
  size: number;
  color: string;
  opacity: number;
  pos: ViewStyle;
}) {
  // Unique gradient id per instance so multiple glows don't share/override defs.
  const gid = `glow-${useId()}`;
  return (
    <Svg width={size} height={size} style={[{ position: 'absolute' }, pos]} pointerEvents="none">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={size} height={size} fill={`url(#${gid})`} />
    </Svg>
  );
}

export function BlobBackground({ variant = 'home' }: { variant?: 'home' | 'group' | 'progress' | 'profile' }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {variant === 'home' && (
        <>
          <Glow size={460} color={PEACH} opacity={0.18} pos={{ top: -150, right: -150 }} />
          <Glow size={360} color={SAGE} opacity={0.15} pos={{ top: 360, left: -150 }} />
        </>
      )}
      {variant === 'group' && (
        <>
          <Glow size={400} color={SAGE} opacity={0.16} pos={{ top: -90, right: -140 }} />
          <Glow size={340} color={PEACH} opacity={0.15} pos={{ top: 220, left: -150 }} />
        </>
      )}
      {variant === 'progress' && (
        <Glow size={460} color={CREAM} opacity={0.12} pos={{ top: -140, right: -170 }} />
      )}
      {variant === 'profile' && (
        <Glow size={420} color={PEACH} opacity={0.17} pos={{ top: -120, left: -150 }} />
      )}
    </View>
  );
}
