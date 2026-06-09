/**
 * Web fallback for the full-screen map (react-native-maps has no web support).
 * Reuses the SquadMap SVG silhouette at full size with selection support.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';

import { SquadMap } from './SquadMap';
import type { SquadMapMember } from '../../lib/api/groups';
import type { Presence } from './ProfileMap';

export function FullMap({
  members,
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const located = members.filter((m) => m.latitude != null && m.longitude != null);

  return (
    <View style={[{ flex: 1, backgroundColor: '#221C18', alignItems: 'center', justifyContent: 'center' }, style]} onLayout={onLayout}>
      {size.w > 0 && (
        <SquadMap
          members={located}
          width={Math.min(size.w - 24, 420)}
          height={size.h - 24}
          onSelect={(m) => onSelect?.(m.user_id)}
          selectedUserId={selected}
        />
      )}
    </View>
  );
}
