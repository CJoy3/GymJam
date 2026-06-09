/**
 * Web fallback for ProfileMap. react-native-maps has no web support, so on web
 * we reuse the hand-illustrated SquadMap silhouette as the backdrop (same data,
 * no native dependency). Keeps the API identical to the native ProfileMap.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SquadMap } from './SquadMap';
import type { SquadMapMember } from '../../lib/api/groups';
import type { Presence } from './ProfileMap';

export function ProfileMap({
  members,
  style,
}: {
  members: SquadMapMember[];
  statusById?: Record<string, Presence>;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#221C18' }, style]} onLayout={onLayout}>
      {size.w > 0 && <SquadMap members={members} width={size.w} height={size.h} compact />}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(27,23,20,0.20)', 'rgba(27,23,20,0.80)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
