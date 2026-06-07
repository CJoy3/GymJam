import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Card, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Gym space — decoration grid */

interface SpaceItemDef { id: string; name: string; emoji: string; unlockElo: number; }
const ROOM_ITEMS: SpaceItemDef[] = [
  { id: 'mat',    name: 'Yoga Mat',    emoji: '🧘', unlockElo: 0 },
  { id: 'db',     name: 'Dumbbells',   emoji: '🏋️', unlockElo: 0 },
  { id: 'plant',  name: 'Plant',       emoji: '🪴', unlockElo: 500 },
  { id: 'bench',  name: 'Bench',       emoji: '🛋️', unlockElo: 500 },
  { id: 'banner', name: 'Banner',      emoji: '🏆', unlockElo: 1000 },
  { id: 'tread',  name: 'Treadmill',   emoji: '🏃', unlockElo: 1000 },
  { id: 'neon',   name: 'Neon Sign',   emoji: '💡', unlockElo: 1200 },
  { id: 'ring',   name: 'Boxing Ring', emoji: '🥊', unlockElo: 2000 },
  { id: 'mascot', name: 'Mascot',      emoji: '🐯', unlockElo: 2000 },
];

export function GymSpace({ onBack }: { onBack: () => void }) {
  const { elo, roomItems, placeRoomItem } = useAppState();
  const placementByItem = new Map(roomItems.map((r) => [r.item_id, r.slot] as const));
  const placedSlots = new Set(roomItems.map((r) => r.slot));

  const unlocked = (it: SpaceItemDef) => elo >= it.unlockElo;
  const freeSlot = () => { for (let s = 0; s < 9; s++) if (!placedSlots.has(s)) return s; return null; };
  const toggle = (it: SpaceItemDef) => {
    if (!unlocked(it)) return;
    if (placementByItem.has(it.id)) { placeRoomItem(it.id, null); return; }
    const f = freeSlot(); if (f === null) return;
    placeRoomItem(it.id, f);
  };

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={20} color={C.ink} />
          </Pressable>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>Your space</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Decorate your gym</H1>
          <Sub style={{ marginTop: 6 }}>Earn rewards by levelling up, then place them</Sub>
        </FadeInItem>

        <FadeInItem delay={120} style={{ marginTop: 24 }}>
          <Card padding={SPACE.md}>
            <View style={styles.roomGrid}>
              {Array.from({ length: 9 }).map((_, slot) => {
                const placement = roomItems.find((r) => r.slot === slot);
                const def = placement && ROOM_ITEMS.find((i) => i.id === placement.item_id);
                return (
                  <View key={slot} style={styles.roomCell}>
                    <View style={[styles.roomTile, def ? { backgroundColor: C.cardHi, borderColor: C.border, borderWidth: 0 } : null]}>
                      {def && <Text style={{ fontSize: 32 }}>{def.emoji}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
            <Sub style={{ textAlign: 'center', marginTop: 12 }}>Tap an item to place · tap a placed item to remove</Sub>
          </Card>
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 22 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Items</Eyebrow>
        </FadeInItem>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ROOM_ITEMS.map((it, i) => {
            const on = unlocked(it);
            const isPlaced = placementByItem.has(it.id);
            return (
              <FadeInItem key={it.id} delay={220 + i * 40} style={{ width: '31%' }}>
                <Pressable
                  disabled={!on}
                  onPress={() => toggle(it)}
                  style={[styles.itemTile, { opacity: on ? 1 : 0.45 }]}
                >
                  <Text style={{ fontSize: 30 }}>{it.emoji}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  {!on && (
                    <View style={styles.lockBadge}>
                      <MaterialIcons name="lock" size={9} color={C.mutedFg} />
                      <Text style={styles.lockText}>{it.unlockElo}</Text>
                    </View>
                  )}
                  {on && isPlaced && (
                    <View style={styles.placedBadge}>
                      <MaterialIcons name="check" size={11} color={C.primaryFg} />
                    </View>
                  )}
                </Pressable>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
