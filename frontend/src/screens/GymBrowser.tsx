import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, H3, IconButton, Sub } from '../ui/components';
import { Slider } from '../ui/Slider';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { usePolling } from '../ui/usePolling';
import { showToast } from '../ui/toast';
import { useAppState, Group } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Gym browser-list + create + leader inbox */

/** Hard cap on ELO staked per missed session-mirrors the backend's ELO_STAKE_CAP. */
const ELO_STAKE_CAP = 500;

export function GymBrowser({ onBack, onJoined, onCreated }: { onBack: () => void; onJoined: () => void; onCreated: () => void }) {
  const { groupId, groups, addGroup, joinGroup, leaveGroup, refreshGroupsAtGym, elo, money } = useAppState();
  const refresh = useRefreshControl();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [freq, setFreq] = useState('3');           // required_pledges per week, 1..7
  const [weeklyStake, setWeeklyStake] = useState('300');  // full ELO at stake for the week
  const [stakeType, setStakeType] = useState<'elo' | 'money'>('elo');
  const [moneyStake, setMoneyStake] = useState(5); // £ at stake for the whole week, 1..20
  const [jt, setJt] = useState<'open' | 'request'>('open');
  const inGroup = groupId !== null;
  usePolling(refreshGroupsAtGym, 12000);

  // Money pots are real stakes → private groups only. Choosing money forces the
  // group private; choosing Open reverts to ELO stakes.
  const pickStakeType = (t: 'elo' | 'money') => {
    setStakeType(t);
    if (t === 'money') setJt('request');
  };
  const pickJoinType = (opt: 'open' | 'request') => {
    setJt(opt);
    if (opt === 'open') setStakeType('elo');
  };

  const join = async (g: Group) => {
    if (inGroup) return;
    const ok = await joinGroup(g.id);
    if (ok && g.joinType === 'open') onJoined();
  };
  // Derive the pot rules from the form so we can validate them before creating.
  const requiredPledges = Math.max(1, Math.min(7, parseInt(freq, 10) || 3));
  // Money pots store pence; the weekly figure is the £1–£20 slider value. ELO
  // pots store the raw ELO total typed in. Either way, the per-miss stake is the
  // weekly total spread across the pledged sessions.
  const weeklyTotal = stakeType === 'money'
    ? moneyStake * 100
    : Math.max(0, parseInt(weeklyStake, 10) || 0);
  const stakeMiss = Math.round(weeklyTotal / requiredPledges);
  const balance = stakeType === 'money' ? money : elo;
  const fmtStake = (amount: number) =>
    stakeType === 'money' ? `£${(amount / 100).toFixed(2)}` : `${amount.toLocaleString()} ELO`;
  // You can't set a stake you couldn't cover yourself: ELO per-miss is capped,
  // and the weekly total must fit your balance.
  const createError = (stakeType === 'elo' && stakeMiss > ELO_STAKE_CAP)
    ? `Max ${ELO_STAKE_CAP} ELO per miss-lower the weekly stake or add sessions.`
    : (weeklyTotal > balance)
      ? `You can't cover ${fmtStake(weeklyTotal)}. Your balance is ${fmtStake(balance)}.`
      : null;

  const create = async () => {
    if (!name.trim()) return;
    if (createError) { showToast(createError, 'info'); return; }
    const ok = await addGroup({
      name: name.trim(),
      weekly_stake_elo: weeklyTotal,
      join_type: stakeType === 'money' ? 'request' : jt,
      stake_type: stakeType,
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
            <IconButton icon="arrow-back" onPress={onBack} />
          </View>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>All groups · any gym</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Browse groups</H1>
          <Sub style={{ marginTop: 6 }}>Groups are global-join friends from any gym. Join requests now appear in the group notifications menu.</Sub>
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

              <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Stake type</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['elo', 'money'] as const).map((opt) => {
                  const on = stakeType === opt;
                  return (
                    <Pressable key={opt} onPress={() => pickStakeType(opt)} style={[styles.jtOpt, on && { borderColor: C.primary, backgroundColor: C.cardHi }]}>
                      <View style={styles.rowGap}>
                        <MaterialIcons name={opt === 'elo' ? 'emoji-events' : 'payments'} size={16} color={on ? C.primary : C.inkSoft} />
                        <Text style={{ fontFamily: FONT.semibold, color: C.ink, fontSize: 14 }}>{opt === 'elo' ? 'ELO' : 'Money'}</Text>
                      </View>
                      <Sub style={{ marginTop: 2, fontSize: 12 }}>{opt === 'elo' ? 'Stake ELO points' : 'Stake real £ (private only)'}</Sub>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: 14 }}>
                <Eyebrow>Sessions / week</Eyebrow>
                <TextInput
                  value={freq}
                  onChangeText={(t) => setFreq(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <Sub style={{ marginTop: 4, fontSize: 11 }}>1–7 days</Sub>
              </View>

              <View style={{ marginTop: 14 }}>
                <View style={styles.rowBetween}>
                  <Eyebrow>Weekly stake</Eyebrow>
                  {stakeType === 'money' && (
                    <Text style={{ fontFamily: FONT.bold, fontSize: 16, color: C.ink }}>£{moneyStake}</Text>
                  )}
                </View>
                {stakeType === 'money' ? (
                  <>
                    <Slider min={1} max={20} value={moneyStake} onChange={setMoneyStake} />
                    <Sub style={{ fontSize: 11 }}>
                      £1–£20 for the week · £{(moneyStake / Math.max(1, Math.min(7, parseInt(freq, 10) || 3))).toFixed(2)} per miss
                    </Sub>
                  </>
                ) : (
                  <>
                    <TextInput
                      value={weeklyStake}
                      onChangeText={(t) => setWeeklyStake(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    <Sub style={{ marginTop: 4, fontSize: 11 }}>
                      Total ELO · {stakeMiss} per miss · max {ELO_STAKE_CAP} per miss
                    </Sub>
                  </>
                )}
                {createError && (
                  <Sub style={{ marginTop: 8, fontSize: 12, color: C.accent }}>{createError}</Sub>
                )}
              </View>

              <Eyebrow style={{ marginTop: 14, marginBottom: 8 }}>Who can join?</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['open', 'request'] as const).map((opt) => {
                  const on = jt === opt;
                  const disabled = stakeType === 'money' && opt === 'open';
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => !disabled && pickJoinType(opt)}
                      style={[styles.jtOpt, on && { borderColor: C.primary, backgroundColor: C.cardHi }, disabled && { opacity: 0.4 }]}
                    >
                      <View style={styles.rowGap}>
                        <MaterialIcons name={opt === 'open' ? 'public' : 'lock'} size={16} color={on ? C.primary : C.inkSoft} />
                        <Text style={{ fontFamily: FONT.semibold, color: C.ink, fontSize: 14 }}>{opt === 'open' ? 'Open' : 'Private'}</Text>
                      </View>
                      <Sub style={{ marginTop: 2, fontSize: 12 }}>
                        {disabled ? 'Not for money pots' : opt === 'open' ? 'Anyone joins instantly' : 'You approve each request'}
                      </Sub>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Btn label="Create & join" disabled={!name.trim() || !!createError} onPress={create} style={{ flex: 1 }} size="md" />
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
                        <Sub>{g.totalElo} ELO</Sub>
                        <Text style={styles.dot}>·</Text>
                        <Sub>{g.joinType === 'open' ? 'Open' : 'Private'}</Sub>
                        {g.stakeType === 'money' && <Chip text="£ Money" tone="accent" compact />}
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
