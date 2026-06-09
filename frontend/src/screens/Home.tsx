import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, Ring, Sub } from '../ui/components';
import { DayPicker } from '../ui/DayPicker';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { LABELS, pageWrap, styles } from './_shared';

/* Home — greeting, this week, pot, primary CTAs */

export function Home({ onCheckIn, onPlan, onPot, onGroup }: { onCheckIn: () => void; onPlan: () => void; onPot: () => void; onGroup: () => void }) {
  const {
    thisWeek, nextWeek, pot, potCurrent, checkInToday, displayName,
    todayDow, thisWeekIsPractice, setThisWeekDays, stakeType, groupId,
    rescheduleMissedDay,
  } = useAppState();
  const isMoney = stakeType === 'money';
  const refresh = useRefreshControl();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned' || d.state === 'locked').length;
  const pct = pledged ? (done / pledged) * 100 : 0;
  const todayState = thisWeek[todayDow]?.state;
  const canCheck = todayState === 'planned' || todayState === 'locked';
  const firstName = displayName.split(' ')[0];

  // Practice (first) week: members pledge the days left after today, no stakes.
  const practiceRemaining = Math.max(0, 6 - todayDow);
  const practiceEditable = thisWeekIsPractice && practiceRemaining > 0;
  const dulledDows = Array.from({ length: todayDow + 1 }, (_, i) => i); // today + past
  const togglePractice = (i: number) => {
    if (i <= todayDow) return;
    const planned = new Set(
      thisWeek.map((d, idx) => ((d.state === 'planned' || d.state === 'locked') ? idx : -1)).filter((x) => x !== -1),
    );
    if (planned.has(i)) planned.delete(i); else planned.add(i);
    setThisWeekDays([...planned]);
  };

  // Long-press a missed day → reschedule it (unforeseen circumstances). If next
  // week has room the session moves with no penalty; if it's full (7 days) a
  // 50% ELO penalty applies instead of a full miss.
  const onRescheduleDay = (i: number) => {
    const nextOccupied = nextWeek.filter((d) => d.state !== 'unselected').length;
    const willMove = nextOccupied + 1 <= 7;
    const stake = potCurrent?.stake_per_miss ?? 0;
    Alert.alert(
      'Reschedule — unforeseen circumstances',
      willMove
        ? 'Move this missed session into next week? No ELO penalty.'
        : `Next week is already full (7 days), so this can't be moved. A 50% penalty (${Math.round(stake * 0.5)} ELO) will apply instead of a full miss.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: willMove ? 'Reschedule' : 'Apply 50% penalty',
          style: willMove ? 'default' : 'destructive',
          onPress: () => rescheduleMissedDay(i),
        },
      ],
    );
  };

  const totalAtStake = potCurrent ? potCurrent.members.reduce((s, m) => s + m.elo_at_risk, 0) : 0;
  const onTrack = potCurrent ? potCurrent.members.filter((m) => m.is_on_track).length : 0;
  const memberCount = potCurrent?.members.length ?? 0;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="home" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Hi, {firstName}</Eyebrow>
          <H1 style={{ marginTop: 6 }}>It's your time</H1>
        </FadeInItem>

        <FadeInItem delay={120} style={{ marginTop: 24 }}>
          <Card padding={SPACE.xl}>
            {/* Header navigates to the group; kept separate from the DayPicker so
                its day-cell gestures (tap to pledge, long-press to reschedule)
                aren't swallowed by a wrapping Pressable. */}
            <Pressable onPress={onGroup} style={[styles.rowBetween, { marginBottom: 16 }]}>
              <View>
                <View style={styles.rowGap}>
                  <Eyebrow style={styles.thisWeekHeader}>This week</Eyebrow>
                  {thisWeekIsPractice && <Chip text="Practice" tone="accent" compact />}
                </View>
                <Text style={styles.pledgeSubhead}>{thisWeekIsPractice ? 'Practice pledge' : 'Your pledge'} · {LABELS[todayDow]}</Text>
              </View>
              <Ring progress={pct} size={68} thickness={6} label={done} sublabel={`/${pledged || 0}`} />
            </Pressable>
            <DayPicker
              days={thisWeek}
              editable={practiceEditable}
              dulledDows={thisWeekIsPractice ? dulledDows : undefined}
              onToggle={practiceEditable ? togglePractice : undefined}
              onReschedule={onRescheduleDay}
            />
            <Sub style={{ marginTop: 14 }}>
              {thisWeekIsPractice
                ? (practiceRemaining > 0
                    ? `Practice week — no ELO at stake. Tap the ${practiceRemaining} day${practiceRemaining === 1 ? '' : 's'} left to pledge. Plan next week as normal.`
                    : 'Practice week — the real challenge starts next week. Plan it below.')
                : pledged === 0 ? 'No sessions pledged yet — plan next week.'
                : pledged - done > 0 ? `${pledged - done} more session${pledged - done === 1 ? '' : 's'} to go.`
                : 'All sessions done. Strong week.'}
            </Sub>
            {thisWeek.some((d) => d.state === 'missed') && (
              <Sub style={{ marginTop: 6, color: C.accent }}>
                Missed a day for unforeseen circumstances? Tap the red day to reschedule it.
              </Sub>
            )}
          </Card>
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 14 }}>
          <Card onPress={onPot} tone="cream" padding={SPACE.xl}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.eyebrowOnCream}>GROUP POT</Text>
                <Text style={styles.potValue}>
                  {isMoney
                    ? <>£{(pot / 100).toFixed(2)}</>
                    : <>{pot.toLocaleString()} <Text style={styles.potUnit}>ELO</Text></>}
                </Text>
              </View>
              <View style={styles.creamArrow}>
                <MaterialIcons name="arrow-forward" size={20} color={C.primaryFg} />
              </View>
            </View>
            <Text style={[styles.subOnCream, { marginTop: 6 }]}>
              {memberCount > 0
                ? `${onTrack} of ${memberCount} on track · ${isMoney ? `£${(totalAtStake / 100).toFixed(2)}` : totalAtStake.toLocaleString()} at stake`
                : groupId
                  ? 'No stakes yet — pledge sessions to build the pot'
                  : 'Join a group to start the pot'}
            </Text>
          </Card>
        </FadeInItem>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ gap: 10 }}>
          <Btn
            label={canCheck ? 'Check in' : 'All sessions checked in'}
            icon={canCheck ? 'place' : 'check-circle'}
            disabled={!canCheck}
            onPress={() => { checkInToday(); onCheckIn(); }}
          />
          <Btn label="Plan next week" variant="ghost" icon="event" onPress={onPlan} />
        </View>
      </View>

    </View>
  );
}
