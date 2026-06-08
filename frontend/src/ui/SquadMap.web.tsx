/**
 * Squad Map (web) — react-native-maps has no web renderer, so the web build
 * falls back to a stylized SVG city-map backdrop (streets, blocks, water,
 * parks) with member pins projected from real lat/lng coordinates (their home
 * gym). Native builds (SquadMap.native.tsx) render an actual interactive
 * Google Maps view instead — see that file for the real-map implementation.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';

// Bounding box pins are projected against — a loose box around Great Britain,
// padded so coastal cities don't sit flush against the edge.
const LAT_MIN = 49.8;
const LAT_MAX = 59.0;
const LNG_MIN = -8.5;
const LNG_MAX = 2.2;

export function project(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * width;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * height;
  return { x, y };
}

// Proportional layout — a slightly uneven city-block grid plus a waterfront
// and a park, so it reads as "a real place" at any tile size rather than a
// generic pattern (mirrors Apple Maps' dark-mode palette: warm charcoal land,
// soft blue water, muted green parks, faint cream street lines).
const V_STREETS = [0.13, 0.29, 0.47, 0.66, 0.84];
const H_STREETS = [0.2, 0.4, 0.61, 0.82];
const BLOCKS = [
  { x: 0.17, y: 0.23, w: 0.1, h: 0.13 },
  { x: 0.33, y: 0.43, w: 0.12, h: 0.14 },
  { x: 0.52, y: 0.24, w: 0.11, h: 0.12 },
  { x: 0.69, y: 0.45, w: 0.1, h: 0.12 },
  { x: 0.36, y: 0.65, w: 0.09, h: 0.11 },
  { x: 0.18, y: 0.45, w: 0.08, h: 0.1 },
];

function MapBackdrop({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  const w = width;
  const h = height;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={h} fill="#241D18" />

      {/* Park — soft green, upper-left */}
      <Path
        d={`M ${w * 0.05},${h * 0.09}
            C ${w * 0.21},${h * 0.03} ${w * 0.31},${h * 0.15} ${w * 0.25},${h * 0.26}
            C ${w * 0.19},${h * 0.35} ${w * 0.04},${h * 0.31} ${w * 0.015},${h * 0.19}
            C ${w * 0.005},${h * 0.13} ${w * 0.015},${h * 0.11} ${w * 0.05},${h * 0.09} Z`}
        fill="rgba(156,181,143,0.26)"
      />

      {/* Water — bay along the bottom-right edge */}
      <Path
        d={`M ${w * 0.6},${h}
            C ${w * 0.68},${h * 0.83} ${w * 0.85},${h * 0.79} ${w},${h * 0.69}
            L ${w},${h} Z`}
        fill="rgba(112,151,179,0.32)"
      />

      {/* Street grid */}
      {V_STREETS.map((f, i) => (
        <Path
          key={`v${i}`}
          d={`M ${w * f},0 L ${w * f},${h}`}
          stroke="rgba(242,229,210,0.10)"
          strokeWidth={i === 2 ? 2 : 1}
        />
      ))}
      {H_STREETS.map((f, i) => (
        <Path
          key={`h${i}`}
          d={`M 0,${h * f} L ${w},${h * f}`}
          stroke="rgba(242,229,210,0.10)"
          strokeWidth={i === 1 ? 2 : 1}
        />
      ))}

      {/* City blocks */}
      {BLOCKS.map((b, i) => (
        <Rect
          key={`b${i}`}
          x={w * b.x} y={h * b.y} width={w * b.w} height={h * b.h}
          rx={Math.min(w, h) * 0.02}
          fill="rgba(242,229,210,0.05)"
        />
      ))}
    </Svg>
  );
}

export interface SquadMapProps {
  members: SquadMapMember[];
  width: number;
  height: number;
  /** Compact mode shows small dots instead of avatars — for use as a backdrop. */
  compact?: boolean;
  onSelect?: (m: SquadMapMember) => void;
  selectedUserId?: string | null;
}

export function SquadMap({ members, width, height, compact = false, onSelect, selectedUserId }: SquadMapProps) {
  const located = members.filter((m) => m.latitude != null && m.longitude != null);
  const pinSize = compact ? 14 : 38;

  return (
    <View style={{ width, height }}>
      <MapBackdrop width={width} height={height} />
      {located.map((m) => {
        const { x, y } = project(m.latitude as number, m.longitude as number, width, height);
        const left = x - pinSize / 2;
        const top = y - pinSize / 2;
        const selected = selectedUserId === m.user_id;
        return (
          <Pressable
            key={m.user_id}
            disabled={!onSelect}
            onPress={() => onSelect?.(m)}
            style={[styles.pinWrap, { left, top, width: pinSize, height: pinSize }]}
          >
            {compact ? (
              <View style={[styles.dot, m.is_me && { backgroundColor: C.accent }]} />
            ) : (
              <Avatar
                id={m.avatar}
                name={m.display_name}
                size={pinSize}
                accent={m.is_me}
                style={[styles.pinAvatar, selected && styles.pinSelected]}
              />
            )}
          </Pressable>
        );
      })}
      {!compact && selectedUserId && located.find((m) => m.user_id === selectedUserId) && (
        <SelectedLabel member={located.find((m) => m.user_id === selectedUserId) as SquadMapMember} width={width} height={height} />
      )}
    </View>
  );
}

function SelectedLabel({ member, width, height }: { member: SquadMapMember; width: number; height: number }) {
  const { x, y } = project(member.latitude as number, member.longitude as number, width, height);
  const left = Math.min(Math.max(x - 70, 4), width - 144);
  const top = Math.max(y - 64, 4);
  return (
    <View style={[styles.label, { left, top }]} pointerEvents="none">
      <Text style={styles.labelName}>{member.is_me ? 'You' : member.display_name}</Text>
      <Text style={styles.labelMeta}>{member.gym_name ?? 'Unknown gym'} · {member.elo.toLocaleString()} ELO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinAvatar: {
    borderWidth: 2,
    borderColor: C.bg,
  },
  pinSelected: {
    borderColor: C.accent,
  },
  dot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: C.success,
    borderWidth: 1.5, borderColor: C.bg,
  },
  label: {
    position: 'absolute',
    width: 140,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.borderHi,
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  labelName: { fontFamily: FONT.bold, fontSize: 13, color: C.ink },
  labelMeta: { fontFamily: FONT.medium, fontSize: 11, color: C.mutedFg, marginTop: 2 },
});
