import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE, tierForElo } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { usePolling } from '../ui/usePolling';
import { useAppState } from '../state/AppState';
import { GymScene, ALL_UNLOCKS } from '../gymspace';
import { getCommunityGym, type CommunityGym as CommunityGymData } from '../../lib/api/groups';
import { pageWrap, styles } from './_shared';

const LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  ALL_UNLOCKS.map((u) => [u.id, u.label]),
);

/**
 * Community gym-every member's personalisable gym joined into one larger,
 * shared space. The scene's tier follows the group's AVERAGE ELO; the
 * equipment is the union of everything members placed in their own gyms
 * (with contribution counts). Read-only: you personalise your own gym in
 * Progress → Gym space, and the community gym reflects it.
 */
export function CommunityGym({ onBrowse }: { onBrowse: () => void }) {
  const { groupId } = useAppState();
  const [data, setData] = useState<CommunityGymData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!groupId) {
      setData(null);
      setLoaded(true);
      return;
    }
    try {
      setData(await getCommunityGym(groupId));
      setLoaded(true);
    } catch {
      // keep prior state on transient errors
    }
  }, [groupId]);
  usePolling(refresh, 15000);

  const placed = useMemo(
    () => new Set((data?.items ?? []).map((i) => i.item_id)),
    [data],
  );

  if (!groupId) {
    return (
      <View style={styles.screen}>
        <BlobBackground variant="celebrate" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl }}>
          <View style={styles.bigCheck}>
            <MaterialIcons name="public" size={48} color={C.accent} />
          </View>
          <FadeInItem delay={100} style={{ alignItems: 'center', marginTop: 24 }}>
            <H1 style={{ textAlign: 'center' }}>No community gym yet</H1>
            <Sub style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
              Join a group and your personal gyms combine into one shared community gym.
            </Sub>
          </FadeInItem>
          <FadeInItem delay={200} style={{ width: '100%', marginTop: 32 }}>
            <Btn label="Browse groups" onPress={onBrowse} icon="search" />
          </FadeInItem>
        </View>
      </View>
    );
  }

  const tierName = tierForElo(data?.avg_elo ?? 0);

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Community gym</Eyebrow>
          <H1 style={{ marginTop: 6 }}>{data?.name ?? 'Your group'}</H1>
          <Sub style={{ marginTop: 6 }}>
            {data
              ? `${data.member_count} ${data.member_count === 1 ? 'member' : 'members'} · ${data.total_elo.toLocaleString()} total ELO · ${tierName} tier`
              : loaded ? 'Your group’s shared gym' : 'Loading…'}
          </Sub>
        </FadeInItem>

        {/* The shared scene: tier from the group's average ELO, equipment is the
            union of every member's placed items (unlockElo=Infinity so a
            contribution always renders, whatever the average tier). */}
        <FadeInItem delay={120} style={{ marginTop: 22 }}>
          <GymScene elo={data?.avg_elo ?? 0} unlockElo={Infinity} aspect={1.3} placedItemIds={placed} />
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 24 }}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Eyebrow>Shared equipment</Eyebrow>
            <Sub>{placed.size} {placed.size === 1 ? 'item' : 'items'}</Sub>
          </View>
          <Card padding={SPACE.lg}>
            {(data?.items?.length ?? 0) === 0 ? (
              <Sub style={{ textAlign: 'center' }}>
                Nothing here yet. Place equipment in your own gym (Progress → Gym space) and it appears in the community gym.
              </Sub>
            ) : (
              <View style={{ gap: 12 }}>
                {data!.items.map((it) => (
                  <View key={it.item_id} style={styles.rowBetween}>
                    <View style={styles.rowGap}>
                      <View style={[styles.iconChip, { backgroundColor: C.successSoft }]}>
                        <MaterialIcons name="fitness-center" size={16} color={C.success} />
                      </View>
                      <Text style={styles.cardTitle}>{LABEL_BY_ID[it.item_id] ?? it.item_id}</Text>
                    </View>
                    <Chip
                      text={`×${it.count}`}
                      tone={it.count > 1 ? 'success' : 'neutral'}
                      compact
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>
        </FadeInItem>

        <FadeInItem delay={240} style={{ marginTop: 24 }}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Eyebrow>Contributors</Eyebrow>
          </View>
        </FadeInItem>
        <View style={{ gap: 12 }}>
          {(data?.members ?? []).map((m, i) => (
            <FadeInItem key={m.user_id} delay={280 + i * 50}>
              <Card padding={SPACE.lg} style={m.is_me ? { borderColor: C.accent, borderWidth: 1.5, backgroundColor: 'rgba(232,155,124,0.06)' } : undefined}>
                <View style={styles.rowBetween}>
                  <View style={[styles.rowGap, { flex: 1 }]}>
                    <Avatar id={m.avatar} name={m.display_name} size={40} accent={m.is_me} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, m.is_me && { color: C.accent }]}>{m.is_me ? 'You' : m.display_name}</Text>
                      <Sub style={{ marginTop: 2 }}>{m.elo.toLocaleString()} ELO</Sub>
                    </View>
                  </View>
                  <Chip
                    text={`${m.items_placed} ${m.items_placed === 1 ? 'item' : 'items'}`}
                    tone={m.items_placed > 0 ? 'accent' : 'neutral'}
                    compact
                  />
                </View>
              </Card>
            </FadeInItem>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
