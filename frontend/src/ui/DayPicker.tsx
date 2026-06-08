import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS } from '../theme/tokens';
import type { DayStatus } from '../state/AppState';

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DayPicker({
  days, editable = false, onToggle, dulledDows, onReschedule,
}: {
  days: DayStatus[];
  editable?: boolean;
  onToggle?: (i: number) => void;
  dulledDows?: number[];
  // Tap a missed day to reschedule it (unforeseen circumstances).
  onReschedule?: (i: number) => void;
}) {
  const dulled = new Set(dulledDows ?? []);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((d, i) => {
        const isDulled = dulled.has(i);
        const canReschedule = !!onReschedule && d.state === 'missed' && !isDulled;
        const canToggle = editable && !isDulled
          && d.state !== 'locked' && d.state !== 'checked-in' && d.state !== 'missed' && d.state !== 'rescheduled';
        const disabled = !canToggle && !canReschedule;
        const s = stateStyle(d.state);
        return (
          <Pressable
            key={i}
            disabled={disabled}
            onPress={() => {
              if (canReschedule) onReschedule?.(i);
              else if (canToggle) onToggle?.(i);
            }}
            style={({ pressed }) => [{
              flex: 1, minWidth: 38, height: 60, borderRadius: RADIUS.md,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: s.borderWidth, borderColor: s.border, backgroundColor: s.bg,
              gap: 3,
            }, isDulled && { opacity: 0.35 }, pressed && !disabled && { opacity: 0.78 }]}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, color: s.fg, letterSpacing: 0.6 }}>{LABELS[i]}</Text>
            {d.state === 'checked-in' && <MaterialIcons name="check" size={16} color={s.fg} />}
            {/* A missed day that can be rescheduled shows a restore hint instead of a plain X. */}
            {d.state === 'missed' && <MaterialIcons name={canReschedule ? 'restore' : 'close'} size={16} color={s.fg} />}
            {d.state === 'planned' && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.fg }} />}
            {d.state === 'locked' && <MaterialIcons name="lock" size={12} color={s.fg} />}
            {d.state === 'rescheduled' && <MaterialIcons name="event-repeat" size={14} color={s.fg} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function JoinableDayRow({
  days, joinedKeys, memberName, onJoin,
}: { days: DayStatus[]; joinedKeys: string[]; memberName: string; onJoin: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((d, i) => {
        const planned = d.state === 'planned' || d.state === 'locked';
        const joined = joinedKeys.includes(`${memberName}-${i}`);
        const bg = planned ? (joined ? C.primary : 'transparent') : C.muted;
        const fg = planned ? (joined ? C.primaryFg : C.ink) : C.mutedFg;
        const border = planned ? C.primary : C.border;
        return (
          <Pressable
            key={i}
            disabled={!planned || joined}
            onPress={() => onJoin(i)}
            style={({ pressed }) => [{
              flex: 1, minWidth: 38, height: 64, borderRadius: RADIUS.md,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: planned && !joined ? 2 : 1, borderColor: border, backgroundColor: bg,
              opacity: planned ? 1 : 0.5, gap: 3,
            }, pressed && planned && !joined && { opacity: 0.78 }]}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, color: fg, letterSpacing: 0.6 }}>{LABELS[i]}</Text>
            {planned && <MaterialIcons name={joined ? 'check' : 'add'} size={16} color={fg} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function stateStyle(state: DayStatus['state']) {
  switch (state) {
    case 'checked-in': return { bg: C.success,     fg: C.primaryFg, border: C.success, borderWidth: 1 };
    case 'planned':    return { bg: 'transparent', fg: C.success,   border: C.success, borderWidth: 2 };
    case 'missed':     return { bg: C.dangerSoft,  fg: C.danger,    border: C.dangerSoft, borderWidth: 1 };
    case 'rescheduled':return { bg: C.accentSoft,  fg: C.accent,    border: C.accentSoft, borderWidth: 1 };
    case 'locked':     return { bg: C.muted,       fg: C.mutedFg,   border: C.muted, borderWidth: 1 };
    default:           return { bg: 'transparent', fg: C.mutedFg,   border: C.border, borderWidth: 1 };
  }
}
