/**
 * Full-screen interactive map (iOS → Apple Maps, no key). Real pan/zoom/rotate.
 *  - Auto-zooms (Find-My style) to frame the squad tightly with no empty space.
 *  - Squad members and gyms are native <Marker>s, so they stay glued to their
 *    real-world coordinate through pan/zoom/rotate/pitch (an absolute-positioned
 *    overlay would drift the moment the map is rotated off north).
 *  - Gyms are initials pins (e.g. "Gym Group" → "GG"), sized by average ELO,
 *    tappable for stats. Only gyms inside the searched area are shown, capped to
 *    the nearest few; panning reveals a "Search this area" button (Google-Maps
 *    style) that re-pins to the new viewport.
 * Web has no native map — see FullMap.web.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';
import type { GymMapBounds, GymMapPoint } from '../../lib/api/gyms';
import type { Presence } from './ProfileMap';

/** Region (center + span) → (south, west, north, east) bounds for a gym query. */
const regionToBounds = (r: Region): GymMapBounds => ({
  south: r.latitude - r.latitudeDelta / 2,
  north: r.latitude + r.latitudeDelta / 2,
  west: r.longitude - r.longitudeDelta / 2,
  east: r.longitude + r.longitudeDelta / 2,
});

const DEFAULT_REGION: Region = { latitude: 51.5072, longitude: -0.1276, latitudeDelta: 0.6, longitudeDelta: 0.6 };
// Hard cap on rendered native markers — too many (we saw ~150 in dense central
// London) overwhelms the map and crashes it. We fetch only a 5-mile radius and
// render the nearest few to the viewport centre; that's plenty on screen at once.
const MAX_GYMS = 50;
// Zoomed out beyond this latitude span (~24 miles), we stop showing gyms and hide
// the "Search this area" button — rendering many pins over a huge area crashed
// the map. We *don't* clamp the native zoom (minZoomLevel freezes Apple Maps —
// it rubber-bands you back in and the map stops responding); instead we just shed
// the gym layer at wide zoom, which is what actually caused the crash.
const SEARCH_MAX_DELTA = 0.35;

/** Pin diameter (px) grows with a gym's average ELO; default ~30px. A non-finite
 *  ELO would yield NaN dimensions, which crashes the native map — so clamp it. */
export const gymDiameter = (avgElo: number) => {
  const e = Number.isFinite(avgElo) ? Math.max(avgElo, 0) : 0;
  return 30 + Math.min(e / 80, 26);
};

/** Apple Maps assert-crashes on NaN/Infinity coordinates — never render those. */
const validPoint = (lat?: number | null, lng?: number | null): boolean =>
  Number.isFinite(lat as number) && Number.isFinite(lng as number) &&
  Math.abs(lat as number) <= 90 && Math.abs(lng as number) <= 180;

export function gymInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '?').slice(0, 2).toUpperCase();
}

const ring = (p?: Presence) => (p === 'in' ? C.success : p === 'pledged' ? C.accent : C.borderHi);

const inBounds = (lat: number, lng: number, r: Region) =>
  Math.abs(lat - r.latitude) <= r.latitudeDelta / 2 && Math.abs(lng - r.longitude) <= r.longitudeDelta / 2;

const movedAway = (a: Region, b: Region | null) => {
  if (!b) return false;
  const zoom = a.latitudeDelta / b.latitudeDelta;
  return (
    Math.abs(a.latitude - b.latitude) > b.latitudeDelta * 0.35 ||
    Math.abs(a.longitude - b.longitude) > b.longitudeDelta * 0.35 ||
    zoom > 1.6 || zoom < 0.6
  );
};

/**
 * A native marker only caches its custom view as a bitmap while
 * `tracksViewChanges` is true. The old approach flipped it off on a fixed timer,
 * but if the child hadn't painted yet the marker cached an empty frame and iOS
 * showed its *default red pin* instead — the "random red pins" bug. Here we keep
 * tracking until the child's `onLayout` fires (it's definitely painted by then),
 * then stop tracking for performance. Selection changes the size, so re-track.
 */
function useRenderUntilLaid(resetKey: unknown) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    // Safety net in case onLayout somehow doesn't fire.
    const t = setTimeout(() => setTracks(false), 2000);
    return () => clearTimeout(t);
  }, [resetKey]);
  return { tracks, onLaidOut: () => setTracks(false) };
}

function GymMarker({ gym, selected, onPress }: { gym: GymMapPoint; selected: boolean; onPress: () => void }) {
  const { tracks, onLaidOut } = useRenderUntilLaid(selected);
  const d = gymDiameter(gym.avg_elo);
  return (
    <Marker
      coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracks}
      zIndex={selected ? 5 : 1}
    >
      <View
        onLayout={onLaidOut}
        style={{
          width: d, height: d, borderRadius: d / 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(27,23,20,0.85)',
          borderWidth: selected ? 3 : 2, borderColor: selected ? C.accent : C.success,
        }}
      >
        <Text style={{ fontFamily: FONT.bold, fontSize: Math.max(11, d * 0.34), color: C.ink }}>{gymInitials(gym.name)}</Text>
      </View>
    </Marker>
  );
}

function MemberMarker({ member, presence, selected, onPress }: { member: SquadMapMember; presence?: Presence; selected: boolean; onPress: () => void }) {
  const { tracks, onLaidOut } = useRenderUntilLaid(selected);
  const sz = selected ? 46 : 38;
  return (
    <Marker
      coordinate={{ latitude: member.latitude as number, longitude: member.longitude as number }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={tracks}
      zIndex={selected ? 20 : 10}
    >
      <View onLayout={onLaidOut} style={[styles.pin, { borderWidth: selected ? 3 : 2, borderColor: ring(presence), backgroundColor: presence === 'in' ? 'rgba(156,181,143,0.30)' : 'rgba(27,23,20,0.40)' }]}>
        <Avatar id={member.avatar} name={member.display_name} size={sz} accent={member.is_me} />
        {member.is_live && <View style={styles.liveDot} />}
      </View>
    </Marker>
  );
}

export function FullMap({
  members,
  gyms,
  statusById,
  selected,
  onSelect,
  selectedGymId,
  onSelectGym,
  onSearchArea,
  focusLocation,
  style,
}: {
  members: SquadMapMember[];
  gyms?: GymMapPoint[];
  statusById?: Record<string, Presence>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  selectedGymId?: string | null;
  onSelectGym?: (id: string) => void;
  /** Fetch gyms for a freshly searched viewport (works anywhere in the UK). */
  onSearchArea?: (bounds: GymMapBounds) => void;
  /** Private current location — when set, the map opens zoomed in on it. */
  focusLocation?: { lat: number; lng: number } | null;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchRegion, setSearchRegion] = useState<Region | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const located = members.filter((m) => validPoint(m.latitude, m.longitude));

  // On open: zoom to the user's current location if we have it (Find-My style),
  // otherwise frame the squad as tightly as possible.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !mapRef.current || !size.w) return;
    if (focusLocation) {
      fitted.current = true;
      mapRef.current.animateToRegion(
        { latitude: focusLocation.lat, longitude: focusLocation.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        600,
      );
      return;
    }
    if (!located.length) return;
    fitted.current = true;
    const coords = located.map((m) => ({ latitude: m.latitude as number, longitude: m.longitude as number }));
    if (coords.length === 1) {
      mapRef.current.animateToRegion({ ...coords[0], latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 150, right: 64, bottom: 180, left: 64 },
        animated: true,
      });
    }
    // Only the count + first layout + focus matter; the `fitted` ref guards re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, size.w, focusLocation]);

  // Gyms confined to the searched area, nearest-first, capped.
  const searchIn = searchRegion ?? region;
  const visibleGyms = (gyms ?? [])
    .filter((g) => validPoint(g.latitude, g.longitude) && inBounds(g.latitude, g.longitude, searchIn))
    .sort((a, b) =>
      (Math.abs(a.latitude - searchIn.latitude) + Math.abs(a.longitude - searchIn.longitude)) -
      (Math.abs(b.latitude - searchIn.latitude) + Math.abs(b.longitude - searchIn.longitude)))
    .slice(0, MAX_GYMS);

  // When zoomed out a long way, disable the gym-search feature entirely: don't
  // render gym pins and hide the search button (prevents the large-area crash).
  const tooZoomedOut = region.latitudeDelta > SEARCH_MAX_DELTA;
  const showSearch = !tooZoomedOut && movedAway(region, searchRegion);

  return (
    <View style={[{ flex: 1 }, style]} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        // Only update on *complete* (gesture/animation end), never per-frame.
        // Updating region state on every frame re-creates all markers ~60×/s and
        // crashes the native map while panning/searching.
        onRegionChangeComplete={(r) => { setRegion(r); setSearchRegion((prev) => prev ?? r); }}
      >
        {/* Gym pins — native markers, glued to their coordinate through rotation.
            Hidden when zoomed too far out (see tooZoomedOut). */}
        {!tooZoomedOut && visibleGyms.map((g) => (
          <GymMarker
            key={g.id}
            gym={g}
            selected={selectedGymId === g.id}
            onPress={() => onSelectGym?.(g.id)}
          />
        ))}

        {/* Member pins */}
        {located.map((m) => (
          <MemberMarker
            key={m.user_id}
            member={m}
            presence={statusById?.[m.user_id]}
            selected={selected === m.user_id}
            onPress={() => onSelect?.(m.user_id)}
          />
        ))}
      </MapView>

      {/* Google-Maps style "search this area" — re-pins gyms to the current view. */}
      {showSearch && (
        <View pointerEvents="box-none" style={styles.searchWrap}>
          <Pressable
            onPress={() => { setSearchRegion(region); onSearchArea?.(regionToBounds(region)); }}
            style={styles.searchBtn}
          >
            <MaterialIcons name="search" size={15} color={C.ink} />
            <Text style={styles.searchText}>Search this area</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    padding: 3,
    borderRadius: 28,
  },
  liveDot: {
    position: 'absolute', top: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.success, borderWidth: 2, borderColor: C.bg,
  },
  searchWrap: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(27,23,20,0.86)',
    borderWidth: 1, borderColor: C.borderHi,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchText: { fontFamily: FONT.bold, fontSize: 13, color: C.ink },
});
