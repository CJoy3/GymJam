import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { FullMap } from '../ui/FullMap';
import { type Presence } from '../ui/ProfileMap';
import { useAppState } from '../state/AppState';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { getGymsMap, type GymMapPoint } from '../../lib/api/gyms';

/* Squad Map — group members on a real map, by their home gym + today's status */

export function SquadMapScreen({ onBack }: { onBack: () => void }) {
  const { groupId, groupName, groupMembers, todayDow } = useAppState();
  const [members, setMembers] = useState<SquadMapMember[]>([]);
  const [gyms, setGyms] = useState<GymMapPoint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    getGymsMap().then(setGyms).catch(() => setGyms([]));
    if (!groupId) { setMembers([]); return; }
    try { setMembers(await getSquadMap(groupId)); } catch { setMembers([]); }
  }, [groupId]);
  useEffect(() => { load(); }, [load]);

  const statusById: Record<string, Presence> = {};
  for (const m of groupMembers) {
    const s = m.thisWeek[todayDow]?.state;
    statusById[m.userId] = s === 'checked-in' ? 'in' : s === 'planned' || s === 'locked' ? 'pledged' : 'rest';
  }

  const located = members.filter((m) => m.latitude != null && m.longitude != null);
  const selectedMember = members.find((m) => m.user_id === selected) ?? null;
  const activeNow = members.filter((m) => statusById[m.user_id] === 'in').length;

  return (
    <View style={styles.screen}>
      <FullMap
        members={members}
        gyms={gyms}
        statusById={statusById}
        selected={selected}
        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      />

      {/* Header overlay */}
      <View style={styles.header} pointerEvents="box-none">
        <Pressable onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={20} color={C.ink} />
        </Pressable>
        <View style={styles.titlePill}>
          <Text style={styles.title}>{groupName || 'Squad'} map</Text>
          <Text style={styles.subtitle}>
            {activeNow > 0 ? `${activeNow} training now · ` : ''}{located.length} on the map
          </Text>
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
            <StatusChip presence={statusById[selectedMember.user_id]} />
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
    backgroundColor: 'rgba(242,229,210,0.92)',
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
  sheetName: { fontFamily: FONT.bold, fontSize: 16, color: C.ink },
  sheetMeta: { fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, marginTop: 2 },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: FONT.semibold, fontSize: 11 },

  empty: {
    position: 'absolute', left: 24, right: 24, bottom: 40,
    backgroundColor: 'rgba(27,23,20,0.78)', borderRadius: RADIUS.md, padding: 14,
  },
  emptyText: { fontFamily: FONT.medium, fontSize: 13, color: C.inkSoft, textAlign: 'center' },
});
