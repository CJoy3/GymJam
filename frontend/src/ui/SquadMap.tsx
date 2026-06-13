/**
 * Squad Map-a stylized landmass silhouette with member pins projected from
 * real lat/lng coordinates (their home gym). Pure SVG + absolutely-positioned
 * RN views, so it renders identically on native and web with no map-tile
 * dependency (mirrors the app's hand-illustrated aesthetic, like BlobBackground).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';

// Bounding box the silhouette is projected against-a loose box around Great
// Britain, padded so coastal cities don't sit flush against the edge.
const LAT_MIN = 49.8;
const LAT_MAX = 59.0;
const LNG_MIN = -8.5;
const LNG_MAX = 2.2;

export function project(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * width;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * height;
  return { x, y };
}

const LAND_PATH =
  'M118,8 C150,6 174,34 168,72 C163,104 184,128 176,168 ' +
  'C168,206 142,222 134,258 C126,292 96,318 72,304 ' +
  'C50,292 56,258 42,228 C28,198 36,156 30,118 ' +
  'C25,82 50,46 76,26 C92,14 104,10 118,8 Z';

const ISLE_PATH = 'M10,150 C28,144 36,168 26,192 C16,212 -2,200 2,176 C5,162 4,156 10,150 Z';

function MapSilhouette({ width, height, tone = C.glowSage }: { width: number; height: number; tone?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 320" style={StyleSheet.absoluteFill}>
      <Path d={LAND_PATH} fill={tone} />
      <Path d={ISLE_PATH} fill={tone} />
      {/* Faint contour rings suggest "map terrain" without claiming cartographic accuracy */}
      <Circle cx={100} cy={150} r={46} stroke={C.borderHi} strokeWidth={1} fill="none" opacity={0.35} />
      <Circle cx={100} cy={150} r={84} stroke={C.borderHi} strokeWidth={1} fill="none" opacity={0.2} />
    </Svg>
  );
}

export interface SquadMapProps {
  members: SquadMapMember[];
  width: number;
  height: number;
  /** Compact mode hides labels/pin chrome-for the small preview behind the avatar. */
  compact?: boolean;
  onSelect?: (m: SquadMapMember) => void;
  selectedUserId?: string | null;
}

export function SquadMap({ members, width, height, compact = false, onSelect, selectedUserId }: SquadMapProps) {
  const located = members.filter((m) => m.latitude != null && m.longitude != null);
  const pinSize = compact ? 16 : 38;

  return (
    <View style={{ width, height }}>
      <MapSilhouette width={width} height={height} tone={compact ? C.glowCream : C.glowSage} />
      {located.map((m) => {
        const { x, y } = project(m.latitude as number, m.longitude as number, 200, 320);
        const left = (x / 200) * width - pinSize / 2;
        const top = (y / 320) * height - pinSize / 2;
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
  const { x, y } = project(member.latitude as number, member.longitude as number, 200, 320);
  const left = Math.min(Math.max((x / 200) * width - 70, 4), width - 144);
  const top = Math.max((y / 320) * height - 64, 4);
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
