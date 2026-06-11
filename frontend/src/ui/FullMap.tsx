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
 * Web has no native map-see FullMap.web.tsx.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import { Glass } from './Glass';
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
// How tightly we zoom onto you when the map opens (~1.3 km span-your street +
// immediate surroundings, so nearby gym pins are still in frame).
const FOCUS_DELTA = 0.0024;
// Where the open-animation STARTS: centred on you but zoomed out (~city level),
// so the map then visibly glides in to your street (a Find-My style fly-in)
// rather than sliding diagonally from the default region.
const FLY_IN_FROM_DELTA = 0.25;
// How long the zoom-in glide takes.
const FLY_IN_MS = 1100;
// Hard cap on rendered native markers. Each is a custom-view marker that
// re-rasterises on mount/remount (open, pan, "Search this area"), and Apple Maps
// crashes once too many do so at once-we saw it at ~150, and 50 still drifted
// into crashes over a long pan+tap+search session. 24 nearest-to-centre pins is
// plenty on screen and keeps the rasterisation spike well inside safe limits.
const MAX_GYMS = 24;
// Zoomed out beyond this latitude span (~24 miles), we stop showing gyms and hide
// the "Search this area" button-rendering many pins over a huge area crashed
// the map. We *don't* clamp the native zoom (minZoomLevel freezes Apple Maps —
// it rubber-bands you back in and the map stops responding); instead we just shed
// the gym layer at wide zoom, which is what actually caused the crash.
const SEARCH_MAX_DELTA = 0.35;

/** Pin diameter (px) grows with a gym's average ELO; default ~30px. A non-finite
 *  ELO would yield NaN dimensions, which crashes the native map-so clamp it. */
export const gymDiameter = (avgElo: number) => {
  const e = Number.isFinite(avgElo) ? Math.max(avgElo, 0) : 0;
  return 30 + Math.min(e / 80, 26);
};

/** Apple Maps assert-crashes on NaN/Infinity coordinates-never render those. */
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
 * `tracksViewChanges` is true. We track until the child's `onLayout` fires (it's
 * definitely painted by then), then stop FOREVER-a marker's appearance never
 * changes after mount, so it never needs to re-rasterise.
 *
 * Why "forever": the previous version re-tracked whenever `selected` changed, to
 * resize/recolour the pin. But `tracks` is React state, so on the tap-render it
 * was still `false` while the child had already changed → react-native-maps
 * BLANKED the cached bitmap ("the gym disappears when I tap it"), and the
 * rasterisation churn that forced on every tap accumulated until Apple Maps
 * CRASHED ("tapping gyms eventually crashes"). Keeping markers visually static
 * kills both: selection is shown by the bottom info card instead.
 */
function useRenderUntilLaid() {
  const [tracks, setTracks] = useState(true);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Safety net in case onLayout somehow doesn't fire.
    const t = setTimeout(() => setTracks(false), 2000);
    return () => { clearTimeout(t); if (settle.current) clearTimeout(settle.current); };
  }, []);
  // Stop tracking a short beat AFTER layout, not synchronously on it. `onLayout`
  // fires when the view is *measured*, but the avatar / pixel-sprite children
  // paint a frame or two later. Snapshotting on layout captured an empty bitmap,
  // so Apple Maps fell back to its default RED dropped-pin annotation. Waiting
  // for paint captures the real custom view; we still settle to false (once)
  // so markers go static and don't churn the map (see the crash note above).
  const onLaidOut = useCallback(() => {
    if (settle.current) return;
    settle.current = setTimeout(() => setTracks(false), 200);
  }, []);
  return { tracks, onLaidOut };
}

/**
 * IMPORTANT: markers are wrapped in React.memo AND are visually static (their
 * appearance never depends on selection). react-native-maps re-rasterises (or,
 * with tracksViewChanges=false, *blanks*) a custom-view marker every time its
 * children change. So markers must never change after their one-time paint:
 *   - memo + referentially-stable props (the gym/member object + a stable
 *     `onPress(id)`) means a tap re-renders NOTHING here, and
 *   - no `selected` styling means there's no child change to blank or re-rasterise.
 * Together that's what stops "the gym disappears when I tap it" and "tapping gyms
 * eventually crashes". Which marker is selected is shown by the bottom info card
 * in SquadMapScreen, not by mutating the pin. Keep all props here primitive/stable
 * and never feed selection into the rendered <View>.
 */
const GymMarker = React.memo(function GymMarker({ gym, onPress }: { gym: GymMapPoint; onPress: (id: string) => void }) {
  const { tracks, onLaidOut } = useRenderUntilLaid();
  const d = gymDiameter(gym.avg_elo);
  return (
    <Marker
      coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onPress(gym.id)}
      tracksViewChanges={tracks}
      zIndex={1}
    >
      <View
        onLayout={onLaidOut}
        style={{
          width: d, height: d, borderRadius: d / 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(27,23,20,0.85)',
          borderWidth: 2, borderColor: C.success,
        }}
      >
        <Text style={{ fontFamily: FONT.bold, fontSize: Math.max(11, d * 0.34), color: C.ink }}>{gymInitials(gym.name)}</Text>
      </View>
    </Marker>
  );
});

const MemberMarker = React.memo(function MemberMarker({ member, presence, onPress }: { member: SquadMapMember; presence?: Presence; onPress: (id: string) => void }) {
  const { tracks, onLaidOut } = useRenderUntilLaid();
  // The child view depends ONLY on appearance, never on position. The live "me"
  // pin updates its coordinate every GPS tick while the map is open; keeping this
  // element referentially stable means react-native-maps just repositions the
  // existing native view instead of re-creating the custom marker view each tick.
  // Re-creating it repeatedly leaks native views on iOS and crashes the map after
  // a few minutes ("crashes when I spend some time on there").
  const child = useMemo(() => (
    <View onLayout={onLaidOut} style={[styles.pin, { borderWidth: 2, borderColor: ring(presence), backgroundColor: presence === 'in' ? 'rgba(156,181,143,0.30)' : 'rgba(27,23,20,0.40)' }]}>
      <Avatar id={member.avatar} name={member.display_name} size={38} accent={member.is_me} />
      {member.is_live && <View style={styles.liveDot} />}
    </View>
  ), [member.avatar, member.display_name, member.is_me, member.is_live, presence, onLaidOut]);
  return (
    <Marker
      coordinate={{ latitude: member.latitude as number, longitude: member.longitude as number }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onPress(member.user_id)}
      tracksViewChanges={tracks}
      zIndex={10}
    >
      {child}
    </Marker>
  );
});

export const FullMap = React.memo(function FullMap({
  members,
  gyms,
  statusById,
  onSelect,
  onSelectGym,
  onSearchArea,
  focusLocation,
  style,
}: {
  members: SquadMapMember[];
  gyms?: GymMapPoint[];
  statusById?: Record<string, Presence>;
  onSelect?: (id: string) => void;
  onSelectGym?: (id: string) => void;
  /** Fetch gyms for a freshly searched viewport (works anywhere in the UK). */
  onSearchArea?: (bounds: GymMapBounds) => void;
  /** Private current location-when set, the map opens zoomed in on it. */
  focusLocation?: { lat: number; lng: number } | null;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Apple Maps silently ignores animateToRegion until the native map has finished
  // initialising. We only animate after onMapReady fires-otherwise the very
  // first focus call (often a quick last-known fix that beats the map) no-ops and
  // the `fitted` flag below then blocks every retry, leaving the map "static".
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchRegion, setSearchRegion] = useState<Region | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // Fallback in case onMapReady never fires (it's occasionally silent on Apple
  // Maps): once the view has laid out, the native map is ready within a beat, so
  // proceed anyway. A no-op if onMapReady already flipped this true.
  useEffect(() => {
    if (!size.w || mapReady) return;
    const t = setTimeout(() => setMapReady(true), 700);
    return () => clearTimeout(t);
  }, [size.w, mapReady]);

  const located = useMemo(
    () => members.filter((m) => validPoint(m.latitude, m.longitude)),
    [members],
  );

  // On open: zoom to the user's CURRENT location (Find-My style), otherwise frame
  // the squad as tightly as possible. `fitted` tracks *what* we framed so a live
  // fix that arrives late (location is async + permission-gated) still wins and
  // re-centres on you-previously, if the squad loaded first we framed it and
  // then ignored the location, leaving the map "static" away from you.
  const fitted = useRef<'none' | 'squad' | 'focus'>('none');
  const focusedAt = useRef<{ lat: number; lng: number } | null>(null);
  // The pending fly-in zoom-in step. Kept in a ref (not as effect cleanup) so the
  // rapid burst of location updates on open-getQuickLocation, then the fresh
  // fix, then the watch-can't cancel the scheduled zoom-in. Only unmount clears
  // it (see below). Without this the timer was cleared on every focus update and
  // the map stayed stuck at the zoomed-OUT start frame and never glided in.
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flyTimer.current) clearTimeout(flyTimer.current); }, []);
  useEffect(() => {
    if (!mapRef.current || !size.w || !mapReady) return;
    if (focusLocation) {
      // Zoom in on first focus, or if the fix jumps a long way (a precise fix
      // correcting the instant rough one). Small movements (walking) don't
      // re-zoom-that would fight the user panning around.
      const prev = focusedAt.current;
      const bigJump = !!prev &&
        (Math.abs(prev.lat - focusLocation.lat) > 0.01 || Math.abs(prev.lng - focusLocation.lng) > 0.01);
      if (fitted.current === 'focus' && !bigJump) return;
      const firstFocus = fitted.current !== 'focus';
      fitted.current = 'focus';
      focusedAt.current = { lat: focusLocation.lat, lng: focusLocation.lng };
      const target = { latitude: focusLocation.lat, longitude: focusLocation.lng, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA };
      if (firstFocus) {
        // Find-My style fly-in: snap centred on you but zoomed out, then glide in
        // so you SEE the map zoom into your street rather than jump straight there.
        mapRef.current.animateToRegion(
          { latitude: focusLocation.lat, longitude: focusLocation.lng, latitudeDelta: FLY_IN_FROM_DELTA, longitudeDelta: FLY_IN_FROM_DELTA },
          0,
        );
        flyTimer.current = setTimeout(() => mapRef.current?.animateToRegion(target, FLY_IN_MS), 350);
        return;
      }
      // A late precise fix that jumped a long way: cancel any pending fly-in and
      // re-centre directly (no second fly-in-you're already looking at the map).
      if (flyTimer.current) clearTimeout(flyTimer.current);
      mapRef.current.animateToRegion(target, 600);
      return;
    }
    if (fitted.current !== 'none' || !located.length) return;
    fitted.current = 'squad';
    const coords = located.map((m) => ({ latitude: m.latitude as number, longitude: m.longitude as number }));
    if (coords.length === 1) {
      mapRef.current.animateToRegion({ ...coords[0], latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 150, right: 64, bottom: 180, left: 64 },
        animated: true,
      });
    }
    // Count + first layout + map-ready + focus matter; the `fitted` ref guards re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, size.w, mapReady, focusLocation]);

  // Stable per-tap handlers so the memoised markers don't all re-render on every
  // selection (that re-render churn was the disappear/crash bug-see GymMarker).
  const handleGymPress = useCallback((id: string) => onSelectGym?.(id), [onSelectGym]);
  const handleMemberPress = useCallback((id: string) => onSelect?.(id), [onSelect]);
  const handleMapReady = useCallback(() => setMapReady(true), []);
  const handleRegionChangeComplete = useCallback((r: Region) => {
    setRegion(r);
    setSearchRegion((prev) => prev ?? r);
  }, []);

  // Gyms confined to the searched area, nearest-first, capped. Memoised so it
  // only recomputes when the data or searched area changes-not when a marker is
  // tapped (selection mustn't churn the whole list; that re-mounts markers).
  const searchIn = searchRegion ?? region;
  const visibleGyms = useMemo(
    () => (gyms ?? [])
      .filter((g) => validPoint(g.latitude, g.longitude) && inBounds(g.latitude, g.longitude, searchIn))
      .sort((a, b) =>
        (Math.abs(a.latitude - searchIn.latitude) + Math.abs(a.longitude - searchIn.longitude)) -
        (Math.abs(b.latitude - searchIn.latitude) + Math.abs(b.longitude - searchIn.longitude)))
      .slice(0, MAX_GYMS),
    // Depend on searchIn's *fields*, not the object-`searchRegion ?? region`
    // is a fresh object each render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gyms, searchIn.latitude, searchIn.longitude, searchIn.latitudeDelta, searchIn.longitudeDelta],
  );

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
        onMapReady={handleMapReady}
        // Only update on *complete* (gesture/animation end), never per-frame.
        // Updating region state on every frame re-creates all markers ~60×/s and
        // crashes the native map while panning/searching.
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {/* Gym pins-native markers, glued to their coordinate through rotation.
            Hidden when zoomed too far out (see tooZoomedOut). */}
        {!tooZoomedOut && visibleGyms.map((g) => (
          <GymMarker
            key={g.id}
            gym={g}
            onPress={handleGymPress}
          />
        ))}

        {/* Member pins */}
        {located.map((m) => (
          <MemberMarker
            key={m.user_id}
            member={m}
            presence={statusById?.[m.user_id]}
            onPress={handleMemberPress}
          />
        ))}
      </MapView>

      {/* Google-Maps style "search this area"-re-pins gyms to the current view. */}
      {showSearch && (
        <View pointerEvents="box-none" style={styles.searchWrap}>
          <Pressable
            onPress={() => { setSearchRegion(region); onSearchArea?.(regionToBounds(region)); }}
            style={styles.searchBtn}
          >
            <Glass radius={999} dim={0.18} style={StyleSheet.absoluteFill} />
            <MaterialIcons name="search" size={15} color={C.ink} />
            <Text style={styles.searchText}>Search this area</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

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
    borderWidth: 1, borderColor: C.borderHi,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchText: { fontFamily: FONT.bold, fontSize: 13, color: C.ink },
});
