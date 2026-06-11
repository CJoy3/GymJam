import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { GymScene, ALL_UNLOCKS } from '../gymspace';
import { pageWrap, styles } from './_shared';

/* Progress-ELO ladder + badges */

type BadgeKey = keyof import('../../lib/api/badges').Badges;
const BADGE_CATALOG: { key: BadgeKey; name: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'first_week', name: 'First Week', icon: 'flag' },
  { key: 'streak_master', name: 'Streak Master', icon: 'local-fire-department' },
  { key: 'early_bird', name: 'Early Bird', icon: 'wb-sunny' },
  { key: 'consistency_king', name: 'Consistency King', icon: 'workspace-premium' },
  { key: 'pot_winner', name: 'Pot Winner', icon: 'paid' },
  { key: 'group_leader', name: 'Group Leader', icon: 'group' },
];

const TIERS = [
  { name: 'Beginner', min: 0, max: 500, icon: 'fitness-center' as const },
  { name: 'Rookie', min: 500, max: 1000, icon: 'directions-run' as const },
  { name: 'Regular', min: 1000, max: 2000, icon: 'sports-martial-arts' as const },
  { name: 'Mogger', min: 2000, max: Infinity, icon: 'military-tech' as const },
];

export function Progress({ onGymSpace }: { onGymSpace: () => void }) {
  const { elo, badges: badgeFlags, roomItems } = useAppState();
  const refresh = useRefreshControl();
  const placedItemIds = new Set(roomItems.map((r) => r.item_id));
  const ti = TIERS.findIndex((t) => elo >= t.min && elo < t.max);
  const cur = TIERS[ti] ?? TIERS[0];
  const next = TIERS[ti + 1];
  const pct = next ? ((elo - cur.min) / (next.min - cur.min)) * 100 : 100;
  const nextUnlock = ALL_UNLOCKS.find((u) => u.elo > elo) ?? null;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Progress</Eyebrow>
          <H1 style={{ marginTop: 6 }}>{cur.name}</H1>
          <Sub style={{ marginTop: 6 }}>Track your growth and unlock rewards</Sub>
        </FadeInItem>

        {/* Pixel-art gym-front and centre. Grows as you climb the arena. */}
        <FadeInItem delay={80} style={{ marginTop: 20 }}>
          <Pressable onPress={onGymSpace}>
            <GymScene elo={elo} placedItemIds={placedItemIds} />
            <View style={[styles.rowBetween, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Eyebrow>Your gym</Eyebrow>
                <Sub style={{ marginTop: 2 }}>
                  {nextUnlock
                    ? `Next unlock: ${nextUnlock.label} · ${nextUnlock.elo.toLocaleString()} ELO`
                    : 'Fully decked out-legendary status'}
                </Sub>
              </View>
              <Chip text="Expand" tone="accent" icon="open-in-full" compact />
            </View>
          </Pressable>
        </FadeInItem>

        <FadeInItem delay={140} style={{ marginTop: 18 }}>
          <Card padding={SPACE.xl}>
            <View style={styles.rowBetween}>
              <View>
                <Eyebrow>Current ELO</Eyebrow>
                <Text style={styles.megaNumber}>{elo.toLocaleString()}</Text>
              </View>
              <Chip text={cur.name} tone="accent" icon="emoji-events" />
            </View>
            {next && (
              <View style={{ marginTop: 16 }}>
                <View style={styles.rowBetween}>
                  <Sub>Progress to {next.name}</Sub>
                  <Text style={{ fontFamily: FONT.semibold, color: C.accent, fontSize: 13 }}>{elo}/{next.min}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
              </View>
            )}
          </Card>
        </FadeInItem>

        <FadeInItem delay={160} style={{ marginTop: 24 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Arena ladder</Eyebrow>
        </FadeInItem>

        <FadeInItem delay={200}>
          <Card padding={0}>
            {TIERS.map((t, i) => {
              const reached = elo >= t.min;
              const current = i === ti;
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
                    <MaterialIcons name={t.icon} size={20} color={reached ? C.primaryFg : C.mutedFg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowGap}>
                      <Text style={[styles.cardTitle, !reached && { color: C.mutedFg }]}>{t.name}</Text>
                      {current && <Chip text="You" tone="accent" compact />}
                    </View>
                    <Sub style={{ marginTop: 2 }}>{t.max === Infinity ? `${t.min}+ ELO` : `${t.min}–${t.max} ELO`}</Sub>
                  </View>
                  {reached
                    ? <MaterialIcons name="check-circle" size={20} color={C.success} />
                    : <MaterialIcons name="lock" size={18} color={C.mutedFg} />}
                </View>
              );
            })}
          </Card>
        </FadeInItem>

        <FadeInItem delay={260} style={{ marginTop: 24 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Badges</Eyebrow>
        </FadeInItem>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {BADGE_CATALOG.map((b, i) => {
            const on = badgeFlags[b.key];
            return (
              <FadeInItem key={b.key} delay={300 + i * 40} style={{ width: '31%' }}>
                <Card padding={SPACE.md} style={{ alignItems: 'center', opacity: on ? 1 : 0.35 }}>
                  <View style={[styles.badgeIcon, { backgroundColor: on ? C.primary : C.muted }]}>
                    <MaterialIcons name={b.icon} size={22} color={on ? C.primaryFg : C.mutedFg} />
                  </View>
                  <Text style={styles.badgeName} numberOfLines={2}>{b.name}</Text>
                </Card>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
