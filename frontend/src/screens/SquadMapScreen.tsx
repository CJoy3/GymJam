import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { Glass } from '../ui/Glass';
import { FullMap, gymInitials } from '../ui/FullMap';
import { type Presence } from '../ui/ProfileMap';
import { useAppState } from '../state/AppState';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { boundsAround, getGymsMap, type GymMapBounds, type GymMapPoint } from '../../lib/api/gyms';
import { getQuickLocation, milesBetween, watchLocation, type Coords } from '../../lib/location';
import { TAB_BAR_CLEARANCE } from './_shared';
import { IconButton } from '../ui/components';

const RADIUS_MILES = 5; // only ever load gyms within this radius of the map's focus
const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 }; // central London, used when the squad isn't located

/** Where to centre the initial gym fetch: the squad's centroid, else central
 *  London. (When a private current location is known it takes priority-see
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

/** Field-level equality for flat API rows (members / gym points). */
function shallowEqual<T extends object>(a: T, b: T): boolean {
  const ka = Object.keys(a) as (keyof T)[];
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Merge a freshly-fetched list into the previous one, KEEPING the previous
 * object for every row whose fields are unchanged (and the previous ARRAY if
 * nothing changed at all). The native markers are memoised on row identity-a
 * refetch that returns the same data as new objects would re-render every
 * custom-view marker, and that re-render churn (blank/re-rasterise while
 * tracksViewChanges=false) is what crashed Apple Maps over long sessions.
 */
function reconcileById<T extends object>(
  prev: T[],
  next: T[],
  idOf: (t: T) => string,
): T[] {
  const prevById = new Map(prev.map((p) => [idOf(p), p]));
  const out = next.map((n) => {
    const p = prevById.get(idOf(n));
    return p && shallowEqual(p, n) ? p : n;
  });
  if (out.length === prev.length && out.every((row, i) => row === prev[i])) return prev;
  return out;
}

/* Squad Map-group members on a real map, by their home gym + today's status */

export function SquadMapScreen({ onBack }: { onBack: () => void }) {
  const { groupId, groupName, groupMembers, todayDow, nudge, nudgeCooldowns, myLocation, refreshMyLocation } = useAppState();

  // My LIVE position while the map is open. Tracked continuously so my pin follows
  // me as I move-and, crucially, so a stale stored fix (e.g. "you were at the
  // gym earlier") never pins me to the wrong place. Device-only; never uploaded.
  const [liveLoc, setLiveLoc] = useState<Coords | null>(null);
  useEffect(() => {
    let cancelled = false;
    // 1) Instant zoom from a RECENT last-known fix (no GPS wait) so the map opens
    //    already zoomed on you. Won't overwrite a fresher value if one beat it.
    getQuickLocation().then((c) => { if (c && !cancelled) setLiveLoc((prev) => prev ?? c); });
    // 2) A precise fresh fix (corrects the quick one if needed); also re-centres
    //    the gym fetch on you. The stored value is never used for the pin/zoom.
    refreshMyLocation().then((c) => { if (c && !cancelled) setLiveLoc(c); });
    // 3) Keep watching so the pin follows you as you move. Ignore sub-~24m jitter
    //    (returning the previous value makes React bail) so standing still doesn't
    //    re-render the live pin every GPS tick-that churn leaked the native
    //    marker view and crashed the map over a long session.
    let sub: { remove: () => void } | null = null;
    watchLocation((c) =>
      setLiveLoc((prev) => (prev && milesBetween(prev, c) < 0.015 ? prev : c)),
    ).then((s) => {
      if (cancelled) s?.remove();
      else sub = s;
    });
    return () => { cancelled = true; sub?.remove(); };
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // My live position (fresh fix + ongoing watch). Stays null-so my pin falls
  // back to my home gym and the map frames the squad-until we have a real fix;
  // never the stale stored value.
  const meLoc = liveLoc;
  const [members, setMembers] = useState<SquadMapMember[]>([]);
  const [gyms, setGyms] = useState<GymMapPoint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedGym, setSelectedGym] = useState<string | null>(null);

  // Latest private location, readable without re-running effects/callbacks that
  // depend on it. Previously `load` depended on `myLocation` directly, so the
  // location refresh on open re-ran it-refetching members AND gyms and
  // replacing every row object, which re-rendered every native marker (the
  // long-session crash; see reconcileById above).
  const myLocationRef = useRef(myLocation);
  myLocationRef.current = myLocation;

  // Where the last gym fetch was centred-used to decide if a fresher private
  // fix has moved far enough to warrant re-centring the gym layer.
  const gymCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  // Fetch gyms within a 5-mile radius of a centre (keeps the payload + marker
  // count small; UK-wide loads were crashing the map). Reconciled so unchanged
  // gyms keep their object identity (no needless marker re-renders), and errors
  // keep the existing pins instead of blanking the layer mid-session.
  const fetchGyms = useCallback((lat: number, lng: number) => {
    gymCenterRef.current = { lat, lng };
    getGymsMap(boundsAround(lat, lng, RADIUS_MILES))
      .then((list) => setGyms((prev) => reconcileById(prev, list, (g) => g.id)))
      .catch(() => { });
  }, []);

  // Members: refetch only when the group changes. Prefer the private current
  // location for the initial gym fetch so you see gyms near *you*, else the squad.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let map: SquadMapMember[] = [];
      if (groupId) {
        try { map = await getSquadMap(groupId); } catch { map = []; }
      }
      if (cancelled) return;
      setMembers((prev) => reconcileById(prev, map, (m) => m.user_id));
      const { lat, lng } = myLocationRef.current ?? squadCenter(map);
      // Skip if the location effect below already fetched this centre.
      const c = gymCenterRef.current;
      if (!c || milesBetween({ lat, lng }, c) >= 1) fetchGyms(lat, lng);
    })();
    return () => { cancelled = true; };
  }, [groupId, fetchGyms]);

  // A fresher private fix (e.g. the permission-gated refresh resolving after
  // open) re-centres the gym layer only if it landed a meaningful distance from
  // the last fetch-same "gyms near you" behaviour as before, without refetching
  // members or churning identical gym rows on every location update.
  useEffect(() => {
    if (!myLocation) return;
    const c = gymCenterRef.current;
    if (c && milesBetween(myLocation, c) < 1) return;
    fetchGyms(myLocation.lat, myLocation.lng);
  }, [myLocation, fetchGyms]);

  // "Search this area"-refetch gyms within 5 miles of the new viewport's centre.
  const searchArea = useCallback((bounds: GymMapBounds) => {
    const lat = (bounds.south + bounds.north) / 2;
    const lng = (bounds.west + bounds.east) / 2;
    fetchGyms(lat, lng);
  }, [fetchGyms]);

  // Memoised AND identity-stable: the root 30s refreshAll poll replaces
  // `groupMembers` with new (usually identical) rows; returning the previous
  // record when the statuses are unchanged keeps FullMap's React.memo intact,
  // so background polls never re-render the native map.
  const statusRef = useRef<Record<string, Presence>>({});
  const statusById = useMemo(() => {
    const out: Record<string, Presence> = {};
    for (const m of groupMembers) {
      const s = m.thisWeek[todayDow]?.state;
      out[m.userId] = s === 'checked-in' ? 'in' : s === 'planned' || s === 'locked' ? 'pledged' : 'rest';
    }
    const prev = statusRef.current;
    const keys = Object.keys(out);
    if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === out[k])) {
      return prev;
    }
    statusRef.current = out;
    return out;
  }, [groupMembers, todayDow]);

  // Plot MYSELF at my real current location, not my home gym. myLocation is the
  // PRIVATE device fix-used only to draw my own pin here; it is never uploaded,
  // so teammates still only see me live if I opt into public sharing. (See the
  // location-privacy split in lib/location.ts.)
  const displayMembers = useMemo(() => {
    if (!meLoc) return members;
    return members.map((m) =>
      m.is_me ? { ...m, latitude: meLoc.lat, longitude: meLoc.lng, is_live: true } : m,
    );
  }, [members, meLoc]);

  // Stable handlers so FullMap's memoised markers don't all re-render on every tap.
  const handleSelectMember = useCallback((id: string) => {
    setSelectedGym(null);
    setSelected((cur) => (cur === id ? null : id));
  }, []);
  const handleSelectGym = useCallback((id: string) => {
    setSelected(null);
    setSelectedGym((cur) => (cur === id ? null : id));
  }, []);

  const located = displayMembers.filter((m) => m.latitude != null && m.longitude != null);
  const selectedMember = displayMembers.find((m) => m.user_id === selected) ?? null;
  const selectedGymPoint = gyms.find((g) => g.id === selectedGym) ?? null;
  const nudgeOnCooldown = selectedMember ? (nudgeCooldowns[selectedMember.user_id] ?? 0) > Date.now() : false;

  return (
    <View style={styles.screen}>
      <FullMap
        members={displayMembers}
        gyms={gyms}
        statusById={statusById}
        onSelect={handleSelectMember}
        onSelectGym={handleSelectGym}
        onSearchArea={searchArea}
        focusLocation={meLoc}
      />

      {/* Header overlay */}
      <View style={styles.header} pointerEvents="box-none">
        <IconButton icon="arrow-back" onPress={onBack} />
        <View style={styles.titlePill}>
          <Glass radius={RADIUS.pill} dim={0.18} style={StyleSheet.absoluteFill} />
          <Text style={styles.title}>{groupName || 'Squad'} map</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Selected member card */}
      {selectedMember && (
        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <Glass radius={RADIUS.lg} dim={0.22} style={StyleSheet.absoluteFill} />
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
            <Glass radius={RADIUS.lg} dim={0.22} style={StyleSheet.absoluteFill} />
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
  titlePill: {
    overflow: 'hidden',
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.borderHi,
    paddingHorizontal: 16, paddingVertical: 8,
    alignItems: 'center',
  },
  title: { fontFamily: FONT.bold, fontSize: 15, color: C.ink },
  subtitle: { fontFamily: FONT.medium, fontSize: 11, color: C.inkSoft, marginTop: 1 },

  // Sits above the floating tab bar (which overlays this full-bleed map) so the
  // selected member / gym card is never hidden behind it.
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACE.xl, paddingBottom: TAB_BAR_CLEARANCE },
  sheetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    overflow: 'hidden',
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
    position: 'absolute', left: 24, right: 24, bottom: TAB_BAR_CLEARANCE,
    backgroundColor: 'rgba(27,23,20,0.78)', borderRadius: RADIUS.md, padding: 14,
  },
  emptyText: { fontFamily: FONT.medium, fontSize: 13, color: C.inkSoft, textAlign: 'center' },
});
