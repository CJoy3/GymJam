import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Leaderboard — global ranking of groups by average member ELO */

const RANK_TONE: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#F4D58D', fg: '#6B4E00' },
  1: { bg: '#E0E0E0', fg: '#4A4A4A' },
  2: { bg: '#E3B08C', fg: '#5A3418' },
};

export function Leaderboard({ onBack }: { onBack: () => void }) {
  const { groupId, groups, refreshGroupsAtGym } = useAppState();
  const refresh = useRefreshControl();
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);

  const ranked = [...groups].sort((a, b) => b.totalElo - a.totalElo);

  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View style={styles.rowBetween}>
            <Pressable onPress={onBack} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>All groups · ranked globally</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Leaderboard</H1>
          <Sub style={{ marginTop: 6 }}>Groups ranked by their members' combined ELO.</Sub>
        </FadeInItem>

        <View style={{ gap: 12, marginTop: 22 }}>
          {ranked.length === 0 ? (
            <FadeInItem delay={120}>
              <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No groups yet.</Sub></Card>
            </FadeInItem>
          ) : (
            ranked.map((g, i) => {
              const isMine = g.id === groupId;
              const tone = RANK_TONE[i];
              return (
                <FadeInItem key={g.id} delay={120 + i * 50}>
                  <Card padding={SPACE.lg} style={isMine ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                    <View style={styles.rowGap}>
                      <View style={[styles.avatar, { backgroundColor: tone?.bg ?? C.muted }]}>
                        <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: tone?.fg ?? C.inkSoft }}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                          <Text style={styles.cardTitle}>{g.name}</Text>
                          {isMine && <Chip text="Your group" tone="success" compact />}
                        </View>
                        <View style={[styles.rowGap, { gap: 8, marginTop: 6, flexWrap: 'wrap' }]}>
                          <Sub>{g.members} {g.members === 1 ? 'member' : 'members'}</Sub>
                          <Text style={styles.dot}>·</Text>
                          <Sub>{g.totalElo} ELO</Sub>
                        </View>
                      </View>
                    </View>
                  </Card>
                </FadeInItem>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
