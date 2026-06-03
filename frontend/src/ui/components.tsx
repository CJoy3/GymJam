import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE } from '../theme/tokens';

/* ---------- Card: soft elevated surface ---------- */
export function Card({
  children, style, onPress, padding,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padding?: number;
}) {
  const content = (
    <View style={[styles.card, padding !== undefined && { padding }, style]}>{children}</View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.998 }] }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

/* ---------- Btn: pill-shaped, three variants ---------- */
export function Btn({
  label, onPress, variant = 'primary', disabled, icon, style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: ViewStyle;
}) {
  const v = {
    primary:   { bg: C.primary, fg: C.primaryFg, border: 'transparent' },
    secondary: { bg: 'transparent', fg: C.ink,    border: C.border },
    tertiary:  { bg: 'transparent', fg: C.ink,    border: 'transparent' },
    danger:    { bg: 'transparent', fg: C.danger, border: C.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
        },
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.82, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {icon && <MaterialIcons name={icon} size={18} color={v.fg} style={{ marginRight: 8 }} />}
      <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Chip: soft pill ---------- */
export function Chip({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'primary' | 'accent' }) {
  const map = {
    muted:   { bg: C.muted,                  fg: C.inkSoft },
    primary: { bg: 'rgba(138,177,125,0.15)', fg: '#A8C99B' },
    accent:  { bg: 'rgba(208,135,112,0.15)', fg: C.accent },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: map.bg }]}>
      <Text style={[styles.chipText, { color: map.fg }]}>{text}</Text>
    </View>
  );
}

export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sub, style]}>{children}</Text>;
}

/* ---------- Ring: progress indicator ---------- */
export function Ring({
  progress, size = 80, label, sublabel,
}: { progress: number; size?: number; label?: string; sublabel?: string }) {
  const clamped = Math.max(0, Math.min(100, progress));
  const deg = (clamped / 100) * 360;
  const ringColor = C.primary;
  const track = C.muted;
  const thickness = Math.max(6, size * 0.085);

  const Half = ({ rotate, color }: { rotate: number; color: string }) => (
    <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: thickness, borderColor: 'transparent',
        borderTopColor: color, borderRightColor: color,
      }} />
    </View>
  );

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: track }} />
      <Half rotate={-135} color={ringColor} />
      {deg > 180 && <Half rotate={Math.min(deg, 360) - 135 - 180} color={ringColor} />}
      <View style={{ alignItems: 'center' }}>
        {label != null && <Text style={{ fontSize: size * 0.26, fontWeight: '700', color: C.ink }}>{label}</Text>}
        {sublabel != null && <Text style={{ fontSize: size * 0.12, color: C.mutedFg }}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.lg,
    padding: SPACE.xl - 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  btn: {
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: SPACE.xl,
  },
  btnText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  chipText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  h1: { fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: '600', color: C.ink, letterSpacing: -0.1 },
  sub: { fontSize: 14, color: C.mutedFg, lineHeight: 19 },
});
