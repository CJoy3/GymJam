/**
 * Squad Map (native) — Google Maps on both iOS and Android via PROVIDER_GOOGLE.
 * Requires a Google Maps API key in app.json (ios.config.googleMapsApiKey and
 * android.config.googleMaps.apiKey). Requires a custom dev client / EAS build.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { C } from '../theme/tokens';
import { Avatar } from './Avatar';
import { DARK_MAP_STYLE } from './mapStyle';
import type { SquadMapMember } from '../../lib/api/groups';

const UK_REGION: Region = { latitude: 54.4, longitude: -3.0, latitudeDelta: 9.5, longitudeDelta: 11 };

function regionFromMembers(members: SquadMapMember[]): Region | null {
  if (members.length === 0) return null;
  const lats = members.map((m) => m.latitude as number);
  const lngs = members.map((m) => m.longitude as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.7, 0.6),
    longitudeDelta: Math.max((maxLng - minLng) * 1.7, 0.6),
  };
}

export interface SquadMapProps {
  members: SquadMapMember[];
  width: number;
  height: number;
  /** Compact mode renders a non-interactive backdrop with simple dots — for use behind the avatar. */
  compact?: boolean;
  onSelect?: (m: SquadMapMember) => void;
  selectedUserId?: string | null;
}

export function SquadMap({ members, width, height, compact = false, onSelect, selectedUserId }: SquadMapProps) {
  const located = useMemo(() => members.filter((m) => m.latitude != null && m.longitude != null), [members]);
  const initialRegion = useMemo(() => regionFromMembers(located) ?? UK_REGION, [located]);

  return (
    <View style={{ width, height, borderRadius: compact ? 0 : 16, overflow: 'hidden' }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={DARK_MAP_STYLE}
        pointerEvents={compact ? 'none' : 'auto'}
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        rotateEnabled={!compact}
        pitchEnabled={!compact}
        toolbarEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={!compact}
      >
        {located.map((m) => {
          const selected = selectedUserId === m.user_id;
          return (
            <Marker
              key={m.user_id}
              coordinate={{ latitude: m.latitude as number, longitude: m.longitude as number }}
              onPress={() => onSelect?.(m)}
              tracksViewChanges={selected}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              {compact ? (
                <View style={[styles.dot, m.is_me && { backgroundColor: C.accent }]} />
              ) : (
                <Avatar
                  id={m.avatar}
                  name={m.display_name}
                  size={38}
                  accent={m.is_me}
                  style={[styles.pinAvatar, selected && styles.pinSelected]}
                />
              )}
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.success,
    borderWidth: 1.5, borderColor: C.bg,
  },
  pinAvatar: {
    borderWidth: 2,
    borderColor: C.bg,
  },
  pinSelected: {
    borderColor: C.accent,
  },
});
