import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, H3, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { usePolling } from '../ui/usePolling';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Pot tracker — conditions + member breakdown */

export function PotTracker({ onBack }: { onBack: () => void }) {
  const { potCurrent, groupMembers, refreshGroup, stakeType } = useAppState();
  const isMoney = stakeType === 'money';
  // Money pots store stake_per_miss in pence; ELO pots store points.
  const fmtStake = (amount: number) =>
    isMoney ? `£${(amount / 100).toFixed(2)}` : `${amount.toLocaleString()} ELO`;
  const refresh = useRefreshControl();
  // The pot moves as teammates check in / miss — keep it live while viewing.
  usePolling(refreshGroup, 9000);
  // Pot rows don't carry avatars; reuse the group members already in state.
  const avatarByUser: Record<string, string | null> = {};
  for (const m of groupMembers) avatarByUser[m.userId] = m.avatar;

  if (!potCurrent) {
    return (
      <View style={styles.screen}>
        <BlobBackground variant="group" />
        <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={20} color={C.ink} />
          </Pressable>
          <FadeInItem delay={60} style={{ marginTop: 18 }}>
            <H1>Weekly pot</H1>
          </FadeInItem>
          <FadeInItem delay={120} style={{ marginTop: 18 }}>
            <Card><Sub style={{ textAlign: 'center' }}>Join a group to see the pot.</Sub></Card>
          </FadeInItem>
        </ScrollView>
      </View>
    );
  }

  const totalAtStake = potCurrent.members.reduce((s, m) => s + m.elo_at_risk, 0);
  const onTrack = potCurrent.members.filter((m) => m.is_on_track).length;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={20} color={C.ink} />
          </Pressable>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>Weekly pot</Eyebrow>
          <Text style={styles.megaNumber}>
            {isMoney ? `£${(potCurrent.total_pot_elo / 100).toFixed(2)}` : potCurrent.total_pot_elo.toLocaleString()}
          </Text>
          <Sub style={{ marginTop: -4 }}>
            {isMoney ? 'in the money pot' : 'ELO in the pot'} · {fmtStake(totalAtStake)} at stake
          </Sub>
        </FadeInItem>

        <FadeInItem delay={120} style={{ marginTop: 22 }}>
          <Card padding={SPACE.xl}>
            <View style={styles.rowBetween}>
              <H3>This week's rules</H3>
              {potCurrent.is_practice
                ? <Chip text="Practice" tone="accent" compact />
                : potCurrent.is_finalized && <Chip text="Frozen" tone="neutral" compact />}
            </View>
            <View style={{ marginTop: 18, gap: 14 }}>
              <RuleRow label="Required pledges" value={String(potCurrent.required_pledges)} />
              <RuleRow label="Stake per miss" value={fmtStake(potCurrent.stake_per_miss)} />
              <RuleRow label="Total at risk / person" value={fmtStake(potCurrent.required_pledges * potCurrent.stake_per_miss)} accent />
            </View>
            <Sub style={{ marginTop: 18 }}>
              {potCurrent.is_practice
                ? `Practice week — no ${isMoney ? 'money' : 'ELO'} at stake. The real pot starts next week.`
                : `${potCurrent.setter_display_name || 'A member'} set these conditions as this week's rule setter (the role rotates weekly).`}
            </Sub>
          </Card>
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 22 }}>
          <View style={[styles.rowBetween, { marginBottom: 14 }]}>
            <Eyebrow>Member breakdown</Eyebrow>
            <Sub>{onTrack} / {potCurrent.members.length} on track</Sub>
          </View>
        </FadeInItem>

        {potCurrent.members.length === 0 ? (
          <Card><Sub style={{ textAlign: 'center' }}>No members in the group yet.</Sub></Card>
        ) : (
          <View style={{ gap: 10 }}>
            {potCurrent.members.map((m, i) => (
              <FadeInItem key={m.user_id} delay={220 + i * 50}>
                <Card padding={SPACE.lg}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowGap}>
                      <Avatar id={avatarByUser[m.user_id]} name={m.display_name} size={40} />
                      <View>
                        <View style={styles.rowGap}>
                          <Text style={styles.cardTitle}>{m.display_name}</Text>
                          {m.role === 'leader' && <Chip text="Leader" tone="accent" compact />}
                        </View>
                        <Sub style={{ marginTop: 2 }}>
                          {m.completed_count} of {m.pledged_count} done
                          {m.missed_count > 0 ? ` · ${m.missed_count} missed` : ''}
                        </Sub>
                      </View>
                    </View>
                    <Chip
                      text={m.is_on_track ? 'On track' : `-${fmtStake(m.elo_lost_so_far)}`}
                      tone={m.is_on_track ? 'success' : 'accent'}
                    />
                  </View>
                </Card>
              </FadeInItem>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function RuleRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <Sub>{label}</Sub>
      <Text style={[styles.ruleValue, accent && { color: C.accent }]}>{value}</Text>
    </View>
  );
}
