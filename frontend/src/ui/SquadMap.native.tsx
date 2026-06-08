/**
 * Squad Map (native) — a real, interactive Google Maps view (the same engine
 * Citymapper/TfL Go use on Android, and react-native-maps' default on iOS is
 * actual Apple Maps via PROVIDER_DEFAULT) with member pins placed at their
 * real home-gym coordinates. Requires a custom dev client / EAS build — this
 * native module isn't available in Expo Go. See app.json for the Google Maps
 * API key fields that must be filled in before building.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { C } from '../theme/tokens';
import { Avatar } from './Avatar';
import { DARK_MAP_STYLE } from './mapStyle';
import type { SquadMapMember } from '../../lib/api/groups';

// Loose box around Great Britain — used as the fallback view when no member
// has a located home gym yet.
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

// iOS renders Apple Maps via the platform's default provider; Android has no
// Apple Maps so it (and web's fallback bundle) use Google Maps.
const provider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

export function SquadMap({ members, width, height, compact = false, onSelect, selectedUserId }: SquadMapProps) {
  const located = useMemo(() => members.filter((m) => m.latitude != null && m.longitude != null), [members]);
  const initialRegion = useMemo(() => regionFromMembers(located) ?? UK_REGION, [located]);

  return (
    <View style={{ width, height, borderRadius: compact ? 0 : 16, overflow: 'hidden' }}>
      <MapView
        provider={provider}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={provider === PROVIDER_GOOGLE ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle="dark"
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
