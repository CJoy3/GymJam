import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE, tierForElo } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, IconButton, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useAppState } from '../state/AppState';
import { GymScene, ALL_UNLOCKS, TIERS, SLOT_BY_ID } from '../gymspace';
import { pageWrap, styles } from './_shared';

/* Gym space-the expanded, editable pixel-art scene + unlock collection */

export function GymSpace({ onBack }: { onBack: () => void }) {
  const { elo, roomItems, placeRoomItem } = useAppState();
  const curTier = tierForElo(elo);
  const placed = new Set(roomItems.map((r) => r.item_id));
  const unlockedCount = ALL_UNLOCKS.filter((u) => elo >= u.elo).length;

  const toggle = (id: string) => {
    if (placed.has(id)) placeRoomItem(id, null);
    else placeRoomItem(id, SLOT_BY_ID[id] ?? 0);
  };

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <IconButton icon="arrow-back" onPress={onBack} />
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>Your gym</Eyebrow>
          <H1 style={{ marginTop: 6 }}>The {curTier} gym</H1>
          <Sub style={{ marginTop: 6 }}>Tap a piece of equipment to place or remove it. Locked gear unlocks as your ELO climbs.</Sub>
        </FadeInItem>

        {/* Editable scene: tap unlocked props (＋ to add, tap to remove). */}
        <FadeInItem delay={120} style={{ marginTop: 22 }}>
          <GymScene elo={elo} aspect={1.3} editable placedItemIds={placed} onToggleItem={toggle} />
        </FadeInItem>

        {/* Arena → gym levels */}
        <FadeInItem delay={180} style={{ marginTop: 24 }}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Eyebrow>Gym levels</Eyebrow>
            <Sub>{curTier}</Sub>
          </View>
        </FadeInItem>
        <FadeInItem delay={220}>
          <Card padding={0}>
            {TIERS.map((t, i) => {
              const reached = elo >= t.min;
              const current = curTier === t.name;
              return (
                <View
                  key={t.name}
                  style={[
                    styles.ladderRow,
                    i < TIERS.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                    current && { backgroundColor: 'rgba(232,155,124,0.06)' },
                  ]}
                >
                  <View style={[styles.ladderIcon, { backgroundColor: reached ? C.primary : C.muted }]}>
                    <MaterialIcons name={reached ? 'fitness-center' : 'lock'} size={18} color={reached ? C.primaryFg : C.mutedFg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowGap}>
                      <Text style={[styles.cardTitle, !reached && { color: C.mutedFg }]}>{t.name} gym</Text>
                      {current && <Chip text="You" tone="accent" compact />}
                    </View>
                    <Sub style={{ marginTop: 2 }}>{t.min === 0 ? 'From the start' : `${t.min.toLocaleString()} ELO`}</Sub>
                  </View>
                  {reached && <MaterialIcons name="check-circle" size={20} color={C.success} />}
                </View>
              );
            })}
          </Card>
        </FadeInItem>

        {/* Equipment-tap an unlocked item to place / remove it. */}
        <FadeInItem delay={280} style={{ marginTop: 24 }}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Eyebrow>Equipment</Eyebrow>
            <Sub>{unlockedCount} / {ALL_UNLOCKS.length} unlocked</Sub>
          </View>
        </FadeInItem>
        <View style={{ gap: 10 }}>
          {ALL_UNLOCKS.map((u, i) => {
            const on = elo >= u.elo;
            const isPlaced = placed.has(u.id);
            return (
              <FadeInItem key={u.id} delay={320 + i * 40}>
                <Pressable disabled={!on} onPress={() => toggle(u.id)}>
                  <Card padding={SPACE.lg} style={on ? undefined : { opacity: 0.5 }}>
                    <View style={styles.rowBetween}>
                      <View style={[styles.rowGap, { flex: 1 }]}>
                        <View style={[styles.iconChip, { backgroundColor: isPlaced ? C.successSoft : C.muted }]}>
                          <MaterialIcons name={!on ? 'lock' : isPlaced ? 'check' : 'add'} size={16} color={isPlaced ? C.success : C.mutedFg} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{u.label}</Text>
                          <Sub style={{ marginTop: 2 }}>
                            {!on ? `Unlocks at ${u.elo.toLocaleString()} ELO` : isPlaced ? 'In your gym · tap to remove' : 'Tap to add to your gym'}
                          </Sub>
                        </View>
                      </View>
                      {!on
                        ? <Sub>{(u.elo - elo).toLocaleString()} to go</Sub>
                        : <Chip text={isPlaced ? 'Placed' : 'Add'} tone={isPlaced ? 'success' : 'neutral'} compact />}
                    </View>
                  </Card>
                </Pressable>
              </FadeInItem>
            );
          })}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}
