/**
 * Real native map backdrop for the profile header (iOS → Apple Maps, no API key;
 * Android → Google Maps). The map itself is decorative (`pointerEvents="none"`)
 * so it never fights the scroll view; squad members are drawn as avatar pins
 * projected from their home-gym coordinates, each with a status halo:
 *   green  = checked in today ("at the gym")
 *   peach  = pledged today, not yet in
 *   faint  = resting
 * Web has no native map — see ProfileMap.web.tsx for the SVG fallback.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';

import { C, FONT } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { SquadMapMember } from '../../lib/api/groups';
import type { GymMapPoint } from '../../lib/api/gyms';
import { gymDiameter, gymInitials } from './FullMap';

export type Presence = 'in' | 'pledged' | 'rest';

const DEFAULT_REGION = { latitude: 51.5072, longitude: -0.1276, latitudeDelta: 0.12, longitudeDelta: 0.12 };

function regionFor(members: SquadMapMember[]) {
  const pts = members.filter((m) => m.latitude != null && m.longitude != null);
  if (!pts.length) return DEFAULT_REGION;
  const lats = pts.map((p) => p.latitude as number);
  const lngs = pts.map((p) => p.longitude as number);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.05),
  };
}

const ringColor = (p?: Presence) =>
  p === 'in' ? C.success : p === 'pledged' ? C.accent : C.borderHi;

export function ProfileMap({
  members,
  gyms,
  statusById,
  style,
}: {
  members: SquadMapMember[];
  gyms?: GymMapPoint[];
  statusById?: Record<string, Presence>;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const region = regionFor(members);
  // Others go on the map; "me" is represented by the big avatar in front.
  const located = members.filter((m) => !m.is_me && m.latitude != null && m.longitude != null);

  const project = (lat: number, lng: number) => ({
    x: ((lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta) * size.w,
    y: ((region.latitude + region.latitudeDelta / 2 - lat) / region.latitudeDelta) * size.h,
  });

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />
      {/* Gym pins — initials circle sized by avg ELO (compact, non-interactive).
          Drawn *under* the scrim below so their cream initials don't clash with
          the cream hero text once gyms load (the scrim sits between them). */}
      {size.w > 0 && (gyms ?? []).map((g) => {
        const { x, y } = project(g.latitude, g.longitude);
        const d = gymDiameter(g.avg_elo) * 0.7;
        if (x < -d || y < -d || x > size.w + d || y > size.h + d) return null;
        return (
          <View
            key={g.id}
            pointerEvents="none"
            style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,23,20,0.82)', borderWidth: 1.5, borderColor: C.success }}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: Math.max(8, d * 0.32), color: C.ink }}>{gymInitials(g.name)}</Text>
          </View>
        );
      })}
      {/* Warm scrim so cream avatars/text stay legible and it matches the theme.
          Sits above the map + gym pins so hero text contrast is unaffected by
          however many gyms load underneath. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(27,23,20,0.45)', 'rgba(27,23,20,0.88)']}
        style={StyleSheet.absoluteFill}
      />
      {size.w > 0 && located.map((m) => {
        const { x, y } = project(m.latitude as number, m.longitude as number);
        const p = statusById?.[m.user_id];
        const sz = 28;
        const left = Math.min(Math.max(x - sz / 2 - 2, 2), size.w - sz - 6);
        const top = Math.min(Math.max(y - sz / 2 - 2, 2), size.h - sz - 6);
        return (
          <View
            key={m.user_id}
            pointerEvents="none"
            style={[
              styles.pin,
              { left, top, borderColor: ringColor(p), backgroundColor: p === 'in' ? 'rgba(156,181,143,0.30)' : 'transparent' },
            ]}
          >
            <Avatar id={m.avatar} name={m.display_name} size={sz} />
            {m.is_live && <View style={styles.liveDot} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    padding: 2,
    borderRadius: 18,
    borderWidth: 2,
  },
  liveDot: {
    position: 'absolute', top: -1, right: -1,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: C.success, borderWidth: 1.5, borderColor: C.bg,
  },
});
