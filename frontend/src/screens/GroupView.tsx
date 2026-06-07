import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, H3, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { DayPicker } from '../ui/DayPicker';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Group view — members + per-day join */

export function GroupView({ onBrowse }: { onBrowse: () => void }) {
  const { groupName, groupMembers, refreshGroupsAtGym, potNext, userId } = useAppState();
  const refresh = useRefreshControl();
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);
  const setterName = potNext?.setter_user_id === userId ? 'You' : potNext?.setter_display_name;
  // Put my row first so I always see myself at the top of the group.
  const orderedMembers = userId
    ? [...groupMembers].sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
    : groupMembers;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Your group</Eyebrow>
              <H1 style={{ marginTop: 6 }}>{groupName}</H1>
              <Sub style={{ marginTop: 6 }}>
                {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'} · this week
              </Sub>
            </View>
            <Pressable onPress={onBrowse} style={styles.iconBtn}>
              <MaterialIcons name="swap-horiz" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        {setterName && (
          <FadeInItem delay={80} style={{ marginTop: 18 }}>
            <Card padding={SPACE.lg} tone="sage">
              <View style={styles.rowGap}>
                <View style={[styles.iconChip, { backgroundColor: C.successSoft }]}>
                  <MaterialIcons name="autorenew" size={18} color={C.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Rule setter · rotates weekly</Eyebrow>
                  <H3 style={{ marginTop: 2 }}>
                    {setterName === 'You' ? "It's your turn to set next week's rules" : `${setterName} sets next week's rules`}
                  </H3>
                </View>
              </View>
            </Card>
          </FadeInItem>
        )}

        {groupMembers.length === 0 ? (
          <FadeInItem delay={140} style={{ marginTop: 18 }}>
            <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No members yet.</Sub></Card>
          </FadeInItem>
        ) : (
          <View style={{ gap: 12, marginTop: 22 }}>
            {orderedMembers.map((m, i) => {
              const pledged = m.thisWeek.filter((d) => d.state !== 'unselected').length;
              const done = m.thisWeek.filter((d) => d.state === 'checked-in').length;
              const notPledging = pledged === 0;
              const isMe = m.userId === userId;
              return (
                <FadeInItem key={m.userId} delay={140 + i * 60}>
                  <Card
                    padding={SPACE.lg}
                    style={{
                      ...(notPledging ? { opacity: 0.55 } : null),
                      ...(isMe ? { borderColor: C.accent, borderWidth: 1.5, backgroundColor: 'rgba(232,155,124,0.06)' } : null),
                    }}
                  >
                    <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                      <View style={styles.rowGap}>
                        <Avatar id={m.avatar} name={m.name} accent={isMe} size={40} />
                        <View>
                          <Text style={[styles.cardTitle, isMe && { color: C.accent }]}>{isMe ? 'You' : m.name}</Text>
                          <Sub style={{ marginTop: 2 }}>
                            {notPledging ? 'Sitting out this week' : `${done} of ${pledged} done`}
                          </Sub>
                        </View>
                      </View>
                      {m.isLeader && <Chip text="Leader" tone="accent" compact />}
                    </View>
                    <DayPicker days={m.thisWeek} />
                  </Card>
                </FadeInItem>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
