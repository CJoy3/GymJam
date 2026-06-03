import React, { useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';

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
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.997 }] }]}
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
        onPressIn={() => { scale.value = withSpring(0.97, { mass: 0.3, stiffness: 80, damping: 5 }); }}
        onPressOut={() => { scale.value = withSpring(1, { mass: 0.3, stiffness: 80, damping: 5 }); }}
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
 * Two-arc progress ring. Animates fill smoothly via Reanimated rotation interpolation.
 */
export function Ring({
  progress, size = 96, label, sublabel, color = C.success, track = C.muted, thickness,
}: {
  progress: number;       // 0..100
  size?: number;
  label?: string | number;
  sublabel?: string;
  color?: string;
  track?: string;
  thickness?: number;
}) {
  const stroke = thickness ?? Math.max(6, size * 0.085);
  const clamped = Math.max(0, Math.min(100, progress));
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 700 });
  }, [animated, clamped]);

  const firstHalf = useAnimatedStyle(() => {
    const deg = Math.min(animated.value, 50) * 3.6;
    return { transform: [{ rotate: `${-135 + deg}deg` }] };
  });
  const secondHalf = useAnimatedStyle(() => {
    const v = Math.max(0, animated.value - 50);
    const deg = v * 3.6;
    return {
      transform: [{ rotate: `${-135 + deg}deg` }],
      opacity: animated.value > 50 ? 1 : 0,
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: track }} />
      <Animated.View style={[StyleSheet.absoluteFill, firstHalf]}>
        <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: 'transparent', borderTopColor: color, borderRightColor: color }} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, secondHalf]}>
        <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: 'transparent', borderTopColor: color, borderRightColor: color }} />
      </Animated.View>
      <View style={{ alignItems: 'center' }}>
        {label != null && <Text style={[styles.ringLabel, { fontSize: size * 0.28 }]}>{label}</Text>}
        {sublabel != null && <Text style={[styles.ringSub, { fontSize: size * 0.13 }]}>{sublabel}</Text>}
      </View>
    </View>
  );
}

/* ──────────────────────  Animated entrance  ──────────────────────── */

export function FadeInItem({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const entering = FadeInDown
    .duration(140)
    .delay(Math.round(delay * 0.75))
    .springify()
    .stiffness(190)
    .damping(20);

  return (
    <Animated.View
      entering={entering}
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

  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },

  btn: {
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: SPACE.xl,
  },
  btnText: { fontFamily: FONT.semibold, fontSize: 16, letterSpacing: 0.1 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: FONT.semibold, letterSpacing: 0.2 },

  ringLabel: { fontFamily: FONT.bold, color: C.ink, letterSpacing: -0.4 },
  ringSub: { fontFamily: FONT.regular, color: C.mutedFg, marginTop: 2 },
});
