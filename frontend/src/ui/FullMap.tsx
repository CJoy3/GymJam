/**
 * Full-screen interactive map (iOS → Apple Maps, no key). Real pan/zoom; squad
 * members are drawn as avatar pins that track the live map region (projected
 * from lat/lng on every region change), each with a check-in status halo.
 * Tapping a pin selects it. Web has no native map — see FullMap.web.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { C } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';
import type { Presence } from './ProfileMap';

const DEFAULT_REGION: Region = { latitude: 51.5072, longitude: -0.1276, latitudeDelta: 0.6, longitudeDelta: 0.6 };

function fitRegion(members: SquadMapMember[]): Region {
  const pts = members.filter((m) => m.latitude != null && m.longitude != null);
  if (!pts.length) return DEFAULT_REGION;
  const lats = pts.map((p) => p.latitude as number);
  const lngs = pts.map((p) => p.longitude as number);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.4),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.4),
  };
}

const ring = (p?: Presence) => (p === 'in' ? C.success : p === 'pledged' ? C.accent : C.borderHi);

export function FullMap({
  members,
  statusById,
  selected,
  onSelect,
  style,
}: {
  members: SquadMapMember[];
  statusById?: Record<string, Presence>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const located = members.filter((m) => m.latitude != null && m.longitude != null);

  // Animate to fit the squad once their coordinates have loaded.
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && located.length && mapRef.current) {
      fitted.current = true;
      mapRef.current.animateToRegion(fitRegion(members), 400);
    }
  }, [located.length, members]);

  const project = (lat: number, lng: number) => ({
    x: ((lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta) * size.w,
    y: ((region.latitude + region.latitudeDelta / 2 - lat) / region.latitudeDelta) * size.h,
  });

  return (
    <View style={[{ flex: 1 }, style]} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        onRegionChange={setRegion}
      />
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
});
