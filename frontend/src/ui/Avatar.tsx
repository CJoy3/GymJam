/**
 * A user avatar: renders the chosen pixel-art face inside a circular chip, or
 * falls back to the user's initials when no avatar is set. Used in the group
 * list, the pot, and the profile.
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

import { C, FONT } from '../theme/tokens';
import { PixelSprite } from '../gymspace/pixel';
import { AVATARS } from '../gymspace/avatars';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  id,
  name,
  size = 40,
  accent = false,
  style,
}: {
  id?: string | null;
  name: string;
  size?: number;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = id ? AVATARS[id] : undefined;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent ? C.accent : C.muted,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {rows ? (
        <PixelSprite rows={rows} pixel={size / 12} />
      ) : (
        <Text style={{ fontFamily: FONT.bold, fontSize: size * 0.34, color: accent ? C.primaryFg : C.ink }}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
