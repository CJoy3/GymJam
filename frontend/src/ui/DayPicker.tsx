import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS } from '../theme/tokens';
import type { DayStatus } from '../state/AppState';

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DayPicker({
  days, editable = false, onToggle,
}: { days: DayStatus[]; editable?: boolean; onToggle?: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {days.map((d, i) => {
        const disabled = !editable || d.state === 'locked';
        const sStyle = stateStyle(d.state);
        return (
          <Pressable
            key={i}
            disabled={disabled}
            onPress={() => onToggle?.(i)}
            style={({ pressed }) => [{
              flex: 1, minWidth: 36, height: 54, borderRadius: RADIUS.md,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: sStyle.borderWidth, borderColor: sStyle.border, backgroundColor: sStyle.bg,
            }, pressed && !disabled && { opacity: 0.78 }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: sStyle.fg, letterSpacing: 0.5 }}>{LABELS[i]}</Text>
            {d.state === 'checked-in' && <MaterialIcons name="check" size={16} color={sStyle.fg} style={{ marginTop: 2 }} />}
            {d.state === 'missed' && <MaterialIcons name="close" size={16} color={sStyle.fg} style={{ marginTop: 2 }} />}
            {d.state === 'planned' && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sStyle.fg, marginTop: 4 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Per-day joinable row: each planned day is an individually tappable chip. */
export function JoinableDayRow({
  days, joinedKeys, memberName, onJoin,
}: { days: DayStatus[]; joinedKeys: string[]; memberName: string; onJoin: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {days.map((d, i) => {
        const planned = d.state === 'planned';
        const joined = joinedKeys.includes(`${memberName}-${i}`);
        const bg = !planned ? 'transparent' : joined ? C.primary : 'transparent';
        const fg = !planned ? C.mutedFg : joined ? C.primaryFg : C.primary;
        return (
          <Pressable
            key={i}
            disabled={!planned || joined}
            onPress={() => onJoin(i)}
            style={({ pressed }) => [{
              flex: 1, minWidth: 36, height: 58, borderRadius: RADIUS.md,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: planned && !joined ? 2 : 1,
              borderColor: planned ? C.primary : C.border,
              backgroundColor: bg, opacity: planned ? 1 : 0.45,
            }, pressed && planned && !joined && { opacity: 0.78 }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: fg, letterSpacing: 0.5 }}>{LABELS[i]}</Text>
            {planned && <MaterialIcons name={joined ? 'check' : 'add'} size={16} color={fg} style={{ marginTop: 2 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function stateStyle(state: DayStatus['state']) {
  switch (state) {
    case 'checked-in': return { bg: C.primary,  fg: C.primaryFg, border: C.primary, borderWidth: 1 };
    case 'planned':    return { bg: 'transparent', fg: C.primary, border: C.primary, borderWidth: 2 };
    case 'missed':     return { bg: C.muted,    fg: C.accent,    border: C.muted,   borderWidth: 1 };
    case 'locked':     return { bg: C.muted,    fg: C.mutedFg,   border: C.muted,   borderWidth: 1 };
    default:           return { bg: 'transparent', fg: C.mutedFg, border: C.border, borderWidth: 1 };
  }
}
