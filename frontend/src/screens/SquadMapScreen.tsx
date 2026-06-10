import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { FullMap, gymInitials } from '../ui/FullMap';
import { type Presence } from '../ui/ProfileMap';
import { useAppState } from '../state/AppState';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { boundsAround, getGymsMap, type GymMapBounds, type GymMapPoint } from '../../lib/api/gyms';

const RADIUS_MILES = 5; // only ever load gyms within this radius of the map's focus
const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 }; // central London, used when the squad isn't located

/** Where to centre the initial gym fetch: the squad's centroid, else central
 *  London. (When a private current location is known it takes priority — see
 *  the caller.) */
function squadCenter(members: SquadMapMember[]): { lat: number; lng: number } {
  const pts = members.filter((m) => m.latitude != null && m.longitude != null);
  if (!pts.length) return DEFAULT_CENTER;
  const me = pts.find((m) => m.is_me);
  if (me) return { lat: me.latitude as number, lng: me.longitude as number };
  const lat = pts.reduce((s, m) => s + (m.latitude as number), 0) / pts.length;
  const lng = pts.reduce((s, m) => s + (m.longitude as number), 0) / pts.length;
  return { lat, lng };
}

/* Squad Map — group members on a real map, by their home gym + today's status */

export function SquadMapScreen({ onBack }: { onBack: () => void }) {
  const { groupId, groupName, groupMembers, todayDow, nudge, nudgeCooldowns, myLocation, refreshMyLocation } = useAppState();

  // Grab the current location on open so the map can zoom to you (idempotent —
  // expo won't re-prompt once granted/denied). Private; never sent to the backend.
  useEffect(() => {
    if (!myLocation) void refreshMyLocation();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [members, setMembers] = useState<SquadMapMember[]>([]);
  const [gyms, setGyms] = useState<GymMapPoint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<string | null>(null);

  const load = useCallback(async () => {
    let map: SquadMapMember[] = [];
    if (groupId) {
      try { map = await getSquadMap(groupId); } catch { map = []; }
    }
    setMembers(map);
    // Only load gyms within a 5-mile radius of the focus (keeps the payload +
    // marker count small; UK-wide loads were crashing the map). Prefer the
    // private current location so you see gyms near *you*, else the squad.
    const { lat, lng } = myLocation ?? squadCenter(map);
    getGymsMap(boundsAround(lat, lng, RADIUS_MILES)).then(setGyms).catch(() => setGyms([]));
  }, [groupId, myLocation]);
  useEffect(() => { load(); }, [load]);

  // "Search this area" — refetch gyms within 5 miles of the new viewport's centre.
  const searchArea = useCallback((bounds: GymMapBounds) => {
    const lat = (bounds.south + bounds.north) / 2;
    const lng = (bounds.west + bounds.east) / 2;
    getGymsMap(boundsAround(lat, lng, RADIUS_MILES)).then(setGyms).catch(() => {});
  }, []);

  const statusById: Record<string, Presence> = {};
  for (const m of groupMembers) {
    const s = m.thisWeek[todayDow]?.state;
    statusById[m.userId] = s === 'checked-in' ? 'in' : s === 'planned' || s === 'locked' ? 'pledged' : 'rest';
  }

  const located = members.filter((m) => m.latitude != null && m.longitude != null);
  const selectedMember = members.find((m) => m.user_id === selected) ?? null;
  const selectedGymPoint = gyms.find((g) => g.id === selectedGym) ?? null;
  const nudgeOnCooldown = selectedMember ? (nudgeCooldowns[selectedMember.user_id] ?? 0) > Date.now() : false;

  return (
    <View style={styles.screen}>
      <FullMap
        members={members}
        gyms={gyms}
        statusById={statusById}
        selected={selected}
        onSelect={(id) => { setSelectedGym(null); setSelected((cur) => (cur === id ? null : id)); }}
        selectedGymId={selectedGym}
        onSelectGym={(id) => { setSelected(null); setSelectedGym((cur) => (cur === id ? null : id)); }}
        onSearchArea={searchArea}
        focusLocation={myLocation}
      />

      {/* Header overlay */}
      <View style={styles.header} pointerEvents="box-none">
        <Pressable onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={20} color={C.ink} />
        </Pressable>
        <View style={styles.titlePill}>
          <Text style={styles.title}>{groupName || 'Squad'} map</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Selected member card */}
      {selectedMember && (
        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <Avatar id={selectedMember.avatar} name={selectedMember.display_name} size={44} accent={selectedMember.is_me} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{selectedMember.is_me ? 'You' : selectedMember.display_name}</Text>
              <Text style={styles.sheetMeta}>
                {(selectedMember.gym_name ?? 'No home gym')} · {selectedMember.elo.toLocaleString()} ELO
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <StatusChip presence={statusById[selectedMember.user_id]} />
              {!selectedMember.is_me && (
                <Pressable
                  onPress={() => nudge(selectedMember.user_id)}
                  disabled={nudgeOnCooldown}
                  style={[styles.nudgeBtn, nudgeOnCooldown && { opacity: 0.45 }]}
                >
                  <MaterialIcons name="campaign" size={15} color={C.ink} />
                  <Text style={styles.nudgeText}>{nudgeOnCooldown ? 'Nudged' : 'Nudge'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Selected gym stats card */}
      {selectedGymPoint && (
        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <View style={styles.gymBadge}>
              <Text style={styles.gymBadgeText}>{gymInitials(selectedGymPoint.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName} numberOfLines={1}>{selectedGymPoint.name}</Text>
              <Text style={styles.sheetMeta}>
                {selectedGymPoint.member_count} {selectedGymPoint.member_count === 1 ? 'member' : 'members'}
                {selectedGymPoint.avg_elo > 0 ? ` · ${selectedGymPoint.avg_elo.toLocaleString()} avg ELO` : ''}
                {selectedGymPoint.active_today > 0 ? ` · ${selectedGymPoint.active_today} today` : ''}
              </Text>
            </View>
            <MaterialIcons name="fitness-center" size={20} color={C.success} />
          </View>
        </View>
      )}

      {located.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyText}>No squad members have a located home gym yet.</Text>
        </View>
      )}
    </View>
  );
}

function StatusChip({ presence }: { presence?: Presence }) {
  const map = {
    in: { label: 'At the gym', color: C.success },
    pledged: { label: 'Pledged today', color: C.accent },
    rest: { label: 'Resting', color: C.mutedFg },
  } as const;
  const s = map[presence ?? 'rest'];
  return (
    <View style={[styles.statusChip, { borderColor: s.color }]}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: SPACE.xl, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(27,23,20,0.82)',
    borderWidth: 1, borderColor: C.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  titlePill: {
    backgroundColor: 'rgba(27,23,20,0.78)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16, paddingVertical: 8,
    alignItems: 'center',
  },
  title: { fontFamily: FONT.bold, fontSize: 15, color: C.ink },
  subtitle: { fontFamily: FONT.medium, fontSize: 11, color: C.inkSoft, marginTop: 1 },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACE.xl, paddingBottom: 36 },
  sheetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.borderHi,
    padding: SPACE.lg,
  },
  gymBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(156,181,143,0.28)', borderWidth: 1.5, borderColor: 'rgba(156,181,143,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  gymBadgeText: { fontFamily: FONT.bold, fontSize: 15, color: C.ink },
  sheetName: { fontFamily: FONT.bold, fontSize: 16, color: C.ink },
  sheetMeta: { fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, marginTop: 2 },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FONT.semibold, fontSize: 11 },

  nudgeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accent,
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  nudgeText: { fontFamily: FONT.bold, fontSize: 12, color: C.ink },

  empty: {
    position: 'absolute', left: 24, right: 24, bottom: 40,
    backgroundColor: 'rgba(27,23,20,0.78)', borderRadius: RADIUS.md, padding: 14,
  },
  emptyText: { fontFamily: FONT.medium, fontSize: 13, color: C.inkSoft, textAlign: 'center' },
});
