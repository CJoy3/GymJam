/**
 * Full-screen interactive map (iOS → Apple Maps, no key). Real pan/zoom.
 *  - Auto-zooms (Find-My style) to frame the squad tightly with no empty space.
 *  - Squad members are avatar pins with a check-in status halo.
 *  - Gyms are initials pins (e.g. "Gym Group" → "GG"), sized by average ELO,
 *    tappable for stats. Only gyms inside the searched area are shown, capped to
 *    the nearest few; panning reveals a "Search this area" button (Google-Maps
 *    style) that re-pins to the new viewport.
 * Web has no native map — see FullMap.web.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';
import type { GymMapPoint } from '../../lib/api/gyms';
import type { Presence } from './ProfileMap';

const DEFAULT_REGION: Region = { latitude: 51.5072, longitude: -0.1276, latitudeDelta: 0.6, longitudeDelta: 0.6 };
const MAX_GYMS = 40; // cap rendered gyms for performance

/** Pin diameter (px) grows with a gym's average ELO; default ~30px. */
export const gymDiameter = (avgElo: number) => 30 + Math.min(avgElo / 80, 26);

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

export function FullMap({
  members,
  gyms,
  statusById,
  selected,
  onSelect,
  selectedGymId,
  onSelectGym,
  style,
}: {
  members: SquadMapMember[];
  gyms?: GymMapPoint[];
  statusById?: Record<string, Presence>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  selectedGymId?: string | null;
  onSelectGym?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchRegion, setSearchRegion] = useState<Region | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const located = members.filter((m) => m.latitude != null && m.longitude != null);

  // Find-My-style auto-zoom: frame the squad as tightly as possible.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !located.length || !mapRef.current || !size.w) return;
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
    // Only the count + first layout matter; the `fitted` ref guards re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, size.w]);

  const project = (lat: number, lng: number) => ({
    x: ((lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta) * size.w,
    y: ((region.latitude + region.latitudeDelta / 2 - lat) / region.latitudeDelta) * size.h,
  });

  // Gyms confined to the searched area, nearest-first, capped.
  const searchIn = searchRegion ?? region;
  const visibleGyms = (gyms ?? [])
    .filter((g) => inBounds(g.latitude, g.longitude, searchIn))
    .sort((a, b) =>
      (Math.abs(a.latitude - searchIn.latitude) + Math.abs(a.longitude - searchIn.longitude)) -
      (Math.abs(b.latitude - searchIn.latitude) + Math.abs(b.longitude - searchIn.longitude)))
    .slice(0, MAX_GYMS);

  const showSearch = movedAway(region, searchRegion);

  return (
    <View style={[{ flex: 1 }, style]} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        onRegionChange={setRegion}
        onRegionChangeComplete={(r) => setSearchRegion((prev) => prev ?? r)}
      />

      {/* Gym pins — initials circle sized by avg ELO; tap for stats. Under members. */}
      {size.w > 0 && visibleGyms.map((g) => {
        const { x, y } = project(g.latitude, g.longitude);
        if (x < -60 || y < -60 || x > size.w + 60 || y > size.h + 60) return null;
        const d = gymDiameter(g.avg_elo);
        const sel = selectedGymId === g.id;
        return (
          <Pressable
            key={g.id}
            onPress={() => onSelectGym?.(g.id)}
            style={{
              position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(27,23,20,0.85)',
              borderWidth: sel ? 3 : 2, borderColor: sel ? C.accent : C.success,
            }}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: Math.max(11, d * 0.34), color: C.ink }}>{gymInitials(g.name)}</Text>
          </Pressable>
        );
      })}

      {/* Member pins */}
      {size.w > 0 && located.map((m) => {
        const { x, y } = project(m.latitude as number, m.longitude as number);
        if (x < -60 || y < -60 || x > size.w + 60 || y > size.h + 60) return null;
        const p = statusById?.[m.user_id];
        const sel = selected === m.user_id;
        const sz = sel ? 46 : 38;
        return (
          <Pressable
            key={m.user_id}
            onPress={() => onSelect?.(m.user_id)}
            style={[styles.pin, { left: x - sz / 2 - 3, top: y - sz / 2 - 3, borderWidth: sel ? 3 : 2, borderColor: ring(p), backgroundColor: p === 'in' ? 'rgba(156,181,143,0.30)' : 'rgba(27,23,20,0.40)' }]}
          >
            <Avatar id={m.avatar} name={m.display_name} size={sz} accent={m.is_me} />
            {m.is_live && <View style={styles.liveDot} />}
          </Pressable>
        );
      })}

      {/* Google-Maps style "search this area" — re-pins gyms to the current view. */}
      {showSearch && (
        <View pointerEvents="box-none" style={styles.searchWrap}>
          <Pressable onPress={() => setSearchRegion(region)} style={styles.searchBtn}>
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
    position: 'absolute',
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
