import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, H3, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState, Group } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Gym browser — list + create + leader inbox */

export function GymBrowser({ onBack, onJoined, onCreated }: { onBack: () => void; onJoined: () => void; onCreated: () => void }) {
  const { groupId, groups, addGroup, joinGroup, leaveGroup, refreshGroupsAtGym } = useAppState();
  const refresh = useRefreshControl();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [freq, setFreq] = useState('3');           // required_pledges per week, 1..7
  const [weeklyStake, setWeeklyStake] = useState('300');  // full ELO at stake for the week
  const [jt, setJt] = useState<'open' | 'request'>('open');
  const inGroup = groupId !== null;
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);

  const join = async (g: Group) => {
    if (inGroup) return;
    const ok = await joinGroup(g.id);
    if (ok && g.joinType === 'open') onJoined();
  };
  const create = async () => {
    if (!name.trim()) return;
    const requiredPledges = Math.max(1, Math.min(7, parseInt(freq, 10) || 3));
    const weeklyTotal = Math.max(0, parseInt(weeklyStake, 10) || 0);
    // Stake per missed session is derived from the full weekly amount / sessions.
    const stakeMiss = Math.round(weeklyTotal / requiredPledges);
    const ok = await addGroup({
      name: name.trim(),
      weekly_stake_elo: weeklyTotal,
      join_type: jt,
      required_pledges: requiredPledges,
      stake_per_miss: stakeMiss,
    });
    if (ok) {
      setCreating(false); setName('');
      onCreated();
    }
  };
  const onLeave = (g: Group) => {
    const sole = g.isLeader === true && g.members <= 1;
    if (sole) {
      if (Platform.OS === 'web') {
        const confirmed = window.confirm('Delete group? You are the only member, so leaving will delete the group.');
        if (confirmed) void leaveGroup();
        return;
      }

      Alert.alert('Delete group?', 'You are the only member, so leaving will delete the group.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => leaveGroup() },
      ]);
    } else { leaveGroup(); }
  };

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
          <Eyebrow>All groups · any gym</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Browse groups</H1>
          <Sub style={{ marginTop: 6 }}>Groups are global — join friends from any gym. Join requests now appear in the group notifications menu.</Sub>
        </FadeInItem>

        <FadeInItem delay={140} style={{ marginTop: 22 }}>
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <Eyebrow>Groups</Eyebrow>
            <Pressable onPress={() => setCreating((c) => !c)} style={styles.linkBtn}>
              <MaterialIcons name={creating ? 'close' : 'add'} size={16} color={C.ink} />
              <Text style={styles.linkText}>{creating ? 'Cancel' : 'New'}</Text>
            </Pressable>
          </View>
        </FadeInItem>

        {creating && (
          <FadeInItem delay={60} style={{ marginBottom: 14 }}>
            <Card padding={SPACE.xl}>
              <H3>Create a group</H3>
              <Sub style={{ marginTop: 4 }}>You'll be the leader.</Sub>

              <Eyebrow style={{ marginTop: 16 }}>Group name</Eyebrow>
              <TextInput value={name} onChangeText={setName} placeholder="6am Club" placeholderTextColor={C.mutedFg} style={styles.input} />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Sessions / week</Eyebrow>
                  <TextInput
                    value={freq}
                    onChangeText={(t) => setFreq(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <Sub style={{ marginTop: 4, fontSize: 11 }}>1–7 days</Sub>
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Weekly stake</Eyebrow>
                  <TextInput
                    value={weeklyStake}
                    onChangeText={(t) => setWeeklyStake(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <Sub style={{ marginTop: 4, fontSize: 11 }}>
                    Total ELO · {Math.round((parseInt(weeklyStake, 10) || 0) / Math.max(1, Math.min(7, parseInt(freq, 10) || 3)))} per miss
                  </Sub>
                </View>
              </View>

              <Eyebrow style={{ marginTop: 14, marginBottom: 8 }}>Who can join?</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['open', 'request'] as const).map((opt) => {
                  const on = jt === opt;
                  return (
                    <Pressable key={opt} onPress={() => setJt(opt)} style={[styles.jtOpt, on && { borderColor: C.primary, backgroundColor: C.cardHi }]}>
                      <View style={styles.rowGap}>
                        <MaterialIcons name={opt === 'open' ? 'public' : 'lock'} size={16} color={on ? C.primary : C.inkSoft} />
                        <Text style={{ fontFamily: FONT.semibold, color: C.ink, fontSize: 14 }}>{opt === 'open' ? 'Open' : 'Private'}</Text>
                      </View>
                      <Sub style={{ marginTop: 2, fontSize: 12 }}>{opt === 'open' ? 'Anyone joins instantly' : 'You approve each request'}</Sub>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Btn label="Create & join" disabled={!name.trim()} onPress={create} style={{ flex: 1 }} size="md" />
                <Btn label="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ flex: 1 }} size="md" />
              </View>
            </Card>
          </FadeInItem>
        )}

        <View style={{ gap: 12 }}>
          {groups.map((g, i) => {
            const isJoined = g.isMember === true;
            const pending = g.requested === true;
            const canAct = !inGroup;
            return (
              <FadeInItem key={g.id} delay={120 + i * 50}>
                <Card padding={SPACE.lg} style={isJoined ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                  <View style={styles.rowGap}>
                    <View style={[styles.avatar, { backgroundColor: isJoined ? C.primary : C.muted }]}>
                      <MaterialIcons name="group" size={20} color={isJoined ? C.primaryFg : C.inkSoft} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                        <Text style={styles.cardTitle}>{g.name}</Text>
                        {isJoined && <Chip text="Joined" tone="success" compact />}
                        {g.isLeader && <Chip text="Leader" tone="accent" compact />}
                      </View>
                      <View style={[styles.rowGap, { gap: 8, marginTop: 6, flexWrap: 'wrap' }]}>
                        <Sub>{g.members} {g.members === 1 ? 'member' : 'members'}</Sub>
                        <Text style={styles.dot}>·</Text>
                        <Sub>{g.stake}</Sub>
                        <Text style={styles.dot}>·</Text>
                        <Sub>{g.joinType === 'open' ? 'Open' : 'Private'}</Sub>
                      </View>
                    </View>
                  </View>
                  <View style={{ marginTop: 14 }}>
                    {isJoined ? (
                      <Btn
                        label={g.isLeader && g.members <= 1 ? 'Delete group' : 'Leave group'}
                        variant={g.isLeader && g.members <= 1 ? 'danger' : 'ghost'}
                        size="md"
                        onPress={() => onLeave(g)}
                      />
                    ) : pending ? (
                      <Btn label="Request pending" variant="ghost" size="md" disabled />
                    ) : (
                      <Btn
                        label={!canAct ? 'Already in a group' : g.joinType === 'open' ? 'Join group' : 'Request to join'}
                        size="md"
                        disabled={!canAct}
                        onPress={() => join(g)}
                      />
                    )}
                  </View>
                </Card>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
