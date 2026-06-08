import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Card, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { SquadMap } from '../ui/SquadMap';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { pageWrap, styles } from './_shared';

/* Squad Map — group members plotted at their home gyms across the UK */

export function SquadMapScreen({ onBack }: { onBack: () => void }) {
  const { groupId, groupName } = useAppState();
  const refresh = useRefreshControl();
  const { width: winWidth } = useWindowDimensions();
  const [members, setMembers] = useState<SquadMapMember[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) { setMembers([]); return; }
    setLoading(true);
    try {
      setMembers(await getSquadMap(groupId));
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const mapWidth = Math.min(winWidth - SPACE.xl * 2, 420);
  const mapHeight = mapWidth * 1.6;

  const located = (members ?? []).filter((m) => m.latitude != null && m.longitude != null);
  const unlocated = (members ?? []).filter((m) => m.latitude == null || m.longitude == null);
  const selectedMember = located.find((m) => m.user_id === selected) ?? null;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View style={styles.rowBetween}>
            <Pressable onPress={onBack} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>{groupName || 'Your group'} · spread across the UK</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Squad map</H1>
          <Sub style={{ marginTop: 6 }}>
            Tap a pin to see who's training where — your group's home gyms, plotted.
          </Sub>
        </FadeInItem>

        <FadeInItem delay={120} style={{ marginTop: 22, alignItems: 'center' }}>
          <Card padding={SPACE.lg} style={{ alignItems: 'center' }}>
            <Pressable onPress={() => setSelected(null)}>
              <SquadMap
                members={located}
                width={mapWidth}
                height={mapHeight}
                onSelect={(m) => setSelected((cur) => (cur === m.user_id ? null : m.user_id))}
                selectedUserId={selected}
              />
            </Pressable>
          </Card>
        </FadeInItem>

        {!loading && located.length === 0 && (
          <FadeInItem delay={160} style={{ marginTop: 16 }}>
            <Card padding={SPACE.xl}>
              <Sub style={{ textAlign: 'center' }}>
                No members have a located home gym yet — pins will appear here once they do.
              </Sub>
            </Card>
          </FadeInItem>
        )}

        {selectedMember && (
          <FadeInItem delay={40} style={{ marginTop: 16 }}>
            <Card padding={SPACE.lg}>
              <View style={styles.rowGap}>
                <Avatar id={selectedMember.avatar} name={selectedMember.display_name} size={40} accent={selectedMember.is_me} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedMember.is_me ? 'You' : selectedMember.display_name}</Text>
                  <Sub style={{ marginTop: 2 }}>
                    {(selectedMember.gym_name ?? 'Unknown gym')} · {selectedMember.elo.toLocaleString()} ELO
                  </Sub>
                </View>
              </View>
            </Card>
          </FadeInItem>
        )}

        {unlocated.length > 0 && (
          <FadeInItem delay={200} style={{ marginTop: 16 }}>
            <Card padding={SPACE.lg}>
              <Eyebrow style={{ marginBottom: 10 }}>Not yet on the map</Eyebrow>
              <View style={{ gap: 10 }}>
                {unlocated.map((m) => (
                  <View key={m.user_id} style={styles.rowGap}>
                    <Avatar id={m.avatar} name={m.display_name} size={32} accent={m.is_me} />
                    <Text style={{ fontFamily: FONT.semibold, color: C.ink, fontSize: 14 }}>
                      {m.is_me ? 'You' : m.display_name}
                    </Text>
                    <Sub>· no home gym set</Sub>
                  </View>
                ))}
              </View>
            </Card>
          </FadeInItem>
        )}
      </ScrollView>
    </View>
  );
}
