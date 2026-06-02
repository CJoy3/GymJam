import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE } from '../theme/tokens';

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>{content}</Pressable>;
  return content;
}

export function Btn({
  label, onPress, variant = 'primary', disabled, icon, style,
}: {
  label: string; onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  disabled?: boolean; icon?: keyof typeof MaterialIcons.glyphMap; style?: ViewStyle;
}) {
  const v = {
    primary: { bg: C.primary, fg: C.primaryFg, border: 'transparent' },
    secondary: { bg: C.bg, fg: C.ink, border: C.primary },
    tertiary: { bg: 'transparent', fg: C.ink, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: variant === 'secondary' ? 2 : 0 },
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      {icon && <MaterialIcons name={icon} size={18} color={v.fg} style={{ marginRight: 6 }} />}
      <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'primary' | 'accent' }) {
  const map = {
    muted: { bg: C.muted, fg: C.mutedFg },
    primary: { bg: 'rgba(168,225,12,0.18)', fg: '#C7F24A' },
    accent: { bg: 'rgba(255,107,74,0.15)', fg: C.accent },
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
export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sub, style]}>{children}</Text>;
}

/** Lightweight progress ring built from Views (no SVG dependency). */
export function Ring({ progress, size = 80, label, sublabel }: { progress: number; size?: number; label?: string; sublabel?: string }) {
  // Simple two-arc trick using rotated half-circles.
  const clamped = Math.max(0, Math.min(100, progress));
  const deg = (clamped / 100) * 360;
  const ringColor = C.primary;
  const track = C.muted;
  const thickness = Math.max(6, size * 0.08);

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
  card: { backgroundColor: C.card, borderRadius: RADIUS.lg, padding: SPACE.lg, borderWidth: 1, borderColor: C.border },
  btn: { height: 52, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: SPACE.xl },
  btnText: { fontSize: 16, fontWeight: '600' },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
  chipText: { fontSize: 12, fontWeight: '600' },
  h1: { fontSize: 30, fontWeight: '700', color: C.ink },
  sub: { fontSize: 14, color: C.mutedFg },
});