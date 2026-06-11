import React, { useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
} from 'react-native';
import Animated, {
  Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Glass } from './Glass';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Shared motion language-short, cubic ease-out, zero spring overshoot.
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_OUT_QUAD = Easing.out(Easing.quad);

/* ──────────────────────────  Typography  ────────────────────────── */

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}
export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function H3({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h3, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sub, style]}>{children}</Text>;
}
export function Num({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.num, style]}>{children}</Text>;
}

/* ────────────────────────────  Card  ─────────────────────────────── */

export function Card({
  children, style, onPress, padding = SPACE.xl, tone = 'default',
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padding?: number;
  tone?: 'default' | 'cream' | 'peach' | 'sage';
}) {
  const bg = tone === 'cream' ? C.primary
    : tone === 'peach' ? C.accentSoft
      : tone === 'sage' ? C.successSoft
        : C.card;
  const border = tone === 'cream' ? 'transparent' : C.border;
  const content = (
    <View style={[styles.card, { padding, backgroundColor: bg, borderColor: border }, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}

/* ────────────────────────────  Button  ───────────────────────────── */

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'inverse';

export function Btn({
  label, onPress, variant = 'primary', disabled, loading, icon, style, size = 'lg',
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: ViewStyle;
  size?: 'md' | 'lg';
}) {
  const v =
    variant === 'primary' ? { bg: C.primary, fg: C.primaryFg, border: 'transparent' }
      : variant === 'inverse' ? { bg: C.card, fg: C.ink, border: C.borderHi }
        : variant === 'danger' ? { bg: 'transparent', fg: C.danger, border: C.danger }
          : { bg: 'transparent', fg: C.ink, border: C.borderHi };

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90, easing: EASE_OUT_QUAD }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 140, easing: EASE_OUT_QUAD }); }}
        style={({ pressed }) => [
          styles.btn,
          {
            height: size === 'md' ? 48 : 56,
            backgroundColor: v.bg,
            borderColor: v.border,
            borderWidth: variant === 'ghost' || variant === 'inverse' || variant === 'danger' ? 1 : 0,
          },
          disabled && { opacity: 0.4 },
          pressed && !disabled && { opacity: 0.92 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {icon && <MaterialIcons name={icon} size={20} color={v.fg} style={{ marginRight: 8 }} />}
            <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ─────────────────────  Icon button (glass)  ─────────────────────── */

/** Round icon button on the liquid-glass material — back / notifications /
 * close and similar chrome. Pass an icon; an optional `children` overlay (e.g.
 * a notification badge) renders above it. Real Liquid Glass on iOS 26, frosted
 * blur elsewhere (see ./Glass). */
export function IconButton({
  icon, onPress, color = C.ink, size = 40, iconSize = 20, style, disabled, children,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Glass radius={size / 2} interactive dim={0.18} style={StyleSheet.absoluteFill} />
      <MaterialIcons name={icon} size={iconSize} color={color} />
      {children}
    </Pressable>
  );
}

/* ────────────────────────────  Chip  ─────────────────────────────── */

export function Chip({
  text, tone = 'neutral', icon, compact,
}: {
  text: string;
  tone?: 'neutral' | 'success' | 'accent' | 'danger' | 'cream';
  icon?: keyof typeof MaterialIcons.glyphMap;
  compact?: boolean;
}) {
  const tones = {
    neutral: { bg: C.muted, fg: C.inkSoft },
    success: { bg: C.successSoft, fg: C.success },
    accent: { bg: C.accentSoft, fg: C.accent },
    danger: { bg: C.dangerSoft, fg: C.danger },
    cream: { bg: C.primary, fg: C.primaryFg },
  }[tone];
  return (
    <View style={[styles.chip, {
      backgroundColor: tones.bg,
      paddingHorizontal: compact ? 8 : 11,
      paddingVertical: compact ? 3 : 5,
    }]}>
      {icon && <MaterialIcons name={icon} size={compact ? 11 : 13} color={tones.fg} style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, { color: tones.fg, fontSize: compact ? 11 : 12 }]}>{text}</Text>
    </View>
  );
}

/* ────────────────────────────  Stat  ─────────────────────────────── */

export function Stat({
  label, value, sub, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: C.accent }]}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

/* ────────────────────────────  Ring  ─────────────────────────────── */

/**
 * Circular progress ring rendered via SVG so the arc length scales strictly
 * with progress. At 0%, the colored arc has zero length (only the muted track
 * shows); at 100%, the full circle is lit. Animates by tweening the dash offset
 * on the UI thread via Reanimated.
 */
export function Ring({
  progress, size = 96, label, sublabel, color = C.success, track = C.muted, thickness,
}: {
  progress: number;
  size?: number;
  label?: string | number;
  sublabel?: string;
  color?: string;
  track?: string;
  thickness?: number;
}) {
  const stroke = thickness ?? Math.max(6, size * 0.085);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 460, easing: EASE_OUT });
  }, [animated, clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value / 100),
  }));

  const center = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* muted track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        {/* progress arc-starts from 12 o'clock, sweeps clockwise */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        {label != null && <Text style={[styles.ringLabel, { fontSize: size * 0.28 }]}>{label}</Text>}
        {sublabel != null && <Text style={[styles.ringSub, { fontSize: size * 0.13 }]}>{sublabel}</Text>}
      </View>
    </View>
  );
}

/* ──────────────────────  Animated entrance  ──────────────────────── */

/**
 * Calm opacity fade with cubic ease-out. No translation, no spring-premium feel.
 */
export function FadeInItem({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  return (
    <Animated.View
      entering={FadeIn.duration(320).delay(delay).easing(EASE_OUT)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/* ─────────────────────────────  Styles  ──────────────────────────── */

const styles = StyleSheet.create({
  eyebrow: { fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, letterSpacing: 0.6, textTransform: 'uppercase' },
  h1: { fontFamily: FONT.extra, fontSize: 32, color: C.ink, letterSpacing: -0.6, lineHeight: 38 },
  h2: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontFamily: FONT.semibold, fontSize: 17, color: C.ink, letterSpacing: -0.1, lineHeight: 22 },
  body: { fontFamily: FONT.regular, fontSize: 15, color: C.ink, lineHeight: 21 },
  sub: { fontFamily: FONT.regular, fontSize: 13, color: C.mutedFg, lineHeight: 18 },
  num: { fontFamily: FONT.bold, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  statValue: { fontFamily: FONT.bold, fontSize: 28, color: C.ink, letterSpacing: -0.4, marginTop: 4 },

  card: { borderRadius: RADIUS.xl, borderWidth: 1 },

  iconButton: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderHi,
    overflow: 'visible',
  },

  btn: {
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: SPACE.xl,
  },
  btnText: { fontFamily: FONT.semibold, fontSize: 16, letterSpacing: 0.1 },

  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.pill, alignSelf: 'flex-start' },
  chipText: { fontFamily: FONT.semibold, letterSpacing: 0.2 },

  ringLabel: { fontFamily: FONT.bold, color: C.ink, letterSpacing: -0.4 },
  ringSub: { fontFamily: FONT.regular, color: C.mutedFg, marginTop: 2 },
});
