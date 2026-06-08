import React, { useEffect, useState } from 'react';
import { Alert, Platform, View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { C, FONT, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import {
  Btn, Card, Chip, Eyebrow, FadeInItem, H1, H3, Num, Ring, Stat, Sub,
} from '../ui/components';
import { DayPicker } from '../ui/DayPicker';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { showToast } from '../ui/toast';
import { useAppState, DayStatus, Group } from '../state/AppState';

const EASE_OUT = Easing.out(Easing.cubic);
const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 32 } as const;
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ╭─────────────────────────────────────────────────────────╮
   │ Onboarding — first-launch gym picker                    │
   ╰─────────────────────────────────────────────────────────╯ */

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { gyms, setGym } = useAppState();
  const [selId, setSelId] = useState<string | null>(null);
  const selName = gyms.find((g) => g.id === selId)?.name;
  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow style={{ marginBottom: 10 }}>Welcome to GymJam</Eyebrow>
          <H1 style={{ marginBottom: 12 }}>Find your home gym</H1>
          <Sub style={{ marginBottom: 28 }}>
            Pick where you train. You'll join your group once you're settled in.
          </Sub>
        </FadeInItem>

        <View style={{ gap: 12 }}>
          {gyms.map((g, i) => {
            const on = selId === g.id;
            return (
              <FadeInItem key={g.id} delay={80 * (i + 1)}>
                <Card
                  onPress={() => setSelId(g.id)}
                  tone={on ? 'cream' : 'default'}
                  padding={SPACE.xl - 4}
                  style={on ? { borderColor: C.primary } : undefined}
                >
                  <View style={styles.rowBetween}>
                    <View style={[styles.rowGap, { flex: 1 }]}>
                      <View style={[styles.iconChip, { backgroundColor: on ? 'rgba(27,23,20,0.08)' : C.accentSoft }]}>
                        <MaterialIcons name="place" size={20} color={on ? C.primaryFg : C.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, on && { color: C.primaryFg }]}>{g.name}</Text>
                      </View>
                    </View>
                    {on && <MaterialIcons name="check-circle" size={22} color={C.primaryFg} />}
                  </View>
                </Card>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Btn
          label={selName ? `Continue with ${selName}` : 'Pick a gym to continue'}
          disabled={!selId}
          onPress={async () => { if (selId) { await setGym(selId); onDone(); } }}
        />
      </View>
    </View>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ Home — greeting, this week, pot, primary CTAs            │
   ╰─────────────────────────────────────────────────────────╯ */

export function Home({ onCheckIn, onPlan, onPot, onGroup }: { onCheckIn: () => void; onPlan: () => void; onPot: () => void; onGroup: () => void }) {
  const {
    thisWeek, nextWeek, elo, streak, pot, potCurrent, checkInToday, displayName,
    todayDow, thisWeekIsPractice, setThisWeekDays, rescheduleMissedDay,
    devClockOffsetDays, advanceClockWeek, previousClockWeek, advanceClockDay, previousClockDay,
  } = useAppState();
  const refresh = useRefreshControl();
  const [clockMoving, setClockMoving] = useState<'next-week' | 'previous-week' | 'next-day' | 'previous-day' | null>(null);
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

  const onShiftClock = async (
    key: NonNullable<typeof clockMoving>,
    action: () => Promise<void>,
  ) => {
    setClockMoving(key);
    try { await action(); } finally { setClockMoving(null); }
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
      <DevClockControls
        moving={clockMoving}
        canGoBack={devClockOffsetDays > 0}
        onPreviousWeek={() => onShiftClock('previous-week', previousClockWeek)}
        onNextWeek={() => onShiftClock('next-week', advanceClockWeek)}
        onPreviousDay={() => onShiftClock('previous-day', previousClockDay)}
        onNextDay={() => onShiftClock('next-day', advanceClockDay)}
      />
      <ScrollView refreshControl={refresh} contentContainerStyle={[pageWrap, { paddingTop: 136 }]} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Hi, {firstName}</Eyebrow>
          <H1 style={{ marginTop: 6 }}>It's your time</H1>
        </FadeInItem>

        {streak > 0 && (
          <FadeInItem delay={60}>
            <View style={{ alignSelf: 'flex-start', marginTop: 12 }}>
              <Chip text={`${streak} week streak`} tone="accent" icon="local-fire-department" />
            </View>
          </FadeInItem>
        )}

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
                <Text style={styles.pledgeSubhead}>{thisWeekIsPractice ? 'Practice pledge' : 'Your pledge'}</Text>
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
                  {pot.toLocaleString()} <Text style={styles.potUnit}>ELO</Text>
                </Text>
              </View>
              <View style={styles.creamArrow}>
                <MaterialIcons name="arrow-forward" size={20} color={C.primaryFg} />
              </View>
            </View>
            <Text style={[styles.subOnCream, { marginTop: 6 }]}>
              {memberCount > 0
                ? `${onTrack} of ${memberCount} on track · ${totalAtStake.toLocaleString()} at stake`
                : 'Join a group to start the pot'}
            </Text>
          </Card>
        </FadeInItem>

        <FadeInItem delay={240} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="ELO" value={elo.toLocaleString()} sub={tierForElo(elo)} />
            </Card>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="STREAK" value={streak} sub={streak === 1 ? 'week' : 'weeks'} accent />
            </Card>
          </View>
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

function DevClockControls({
  moving, canGoBack, onPreviousWeek, onNextWeek, onPreviousDay, onNextDay,
}: {
  moving: 'next-week' | 'previous-week' | 'next-day' | 'previous-day' | null;
  canGoBack: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
}) {
  const disabled = moving !== null;
  return (
    <View style={styles.devControls}>
      <View style={styles.devControlRow}>
        <DevClockButton
          label="Previous week"
          icon="keyboard-arrow-left"
          loading={moving === 'previous-week'}
          disabled={disabled || !canGoBack}
          onPress={onPreviousWeek}
        />
        <DevClockButton
          label="Next week"
          icon="keyboard-arrow-right"
          loading={moving === 'next-week'}
          disabled={disabled}
          onPress={onNextWeek}
        />
      </View>
      <View style={styles.devControlRow}>
        <DevClockButton
          label="Previous day"
          icon="keyboard-arrow-left"
          loading={moving === 'previous-day'}
          disabled={disabled || !canGoBack}
          onPress={onPreviousDay}
        />
        <DevClockButton
          label="Next day"
          icon="keyboard-arrow-right"
          loading={moving === 'next-day'}
          disabled={disabled}
          onPress={onNextDay}
        />
      </View>
    </View>
  );
}

function DevClockButton({
  label, icon, loading, disabled, onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.devClockBtn,
        disabled && styles.devClockBtnDisabled,
        pressed && !disabled && { opacity: 0.82 },
      ]}
    >
      <MaterialIcons name={loading ? 'hourglass-empty' : icon} size={15} color={C.primaryFg} />
      <Text style={styles.devClockBtnText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ CheckIn — celebratory success screen                     │
   ╰─────────────────────────────────────────────────────────╯ */

export function CheckIn({ onClose }: { onClose: () => void }) {
  const { thisWeek, gymName, elo } = useAppState();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned' || d.state === 'locked').length;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <View style={{ flex: 1, padding: SPACE.xl, paddingTop: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View entering={FadeIn.duration(320).easing(EASE_OUT)} style={styles.bigCheck}>
          <MaterialIcons name="check" size={56} color={C.success} />
        </Animated.View>
        <FadeInItem delay={120} style={{ alignItems: 'center', marginTop: 28 }}>
          <H1 style={{ textAlign: 'center' }}>Well done</H1>
          <Sub style={{ textAlign: 'center', marginTop: 6 }}>Session counted at {gymName || 'your gym'}</Sub>
        </FadeInItem>

        <FadeInItem delay={220} style={{ width: '100%', marginTop: 36 }}>
          <Card padding={SPACE.xl}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <SimpleStat label="Done"    value={String(done)}    color={C.success} />
              <SimpleStat label="Pledged" value={String(pledged)} />
              <SimpleStat label="ELO"     value="+10"             color={C.accent} />
            </View>
          </Card>
        </FadeInItem>

        <FadeInItem delay={320} style={{ width: '100%', marginTop: 36 }}>
          <Btn label="Back to home" onPress={onClose} />
        </FadeInItem>

        <Sub style={{ marginTop: 24, textAlign: 'center' }}>Now at {elo.toLocaleString()} ELO</Sub>
      </View>
    </View>
  );
}

function SimpleStat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: FONT.bold, fontSize: 26, color, letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ Plan next week — local state + PotConditionsEditor       │
   ╰─────────────────────────────────────────────────────────╯ */

export function PlanWeek({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const {
    nextWeek, setPlannedDays, groupName, potNext, updatePotConditions,
    userId, groupMembers,
  } = useAppState();
  // The rule setter rotates weekly — only the setter for next week may edit it.
  const isNextSetter = !!potNext && potNext.setter_user_id != null && potNext.setter_user_id === userId;
  const [local, setLocal] = useState<DayStatus['state'][]>(() => nextWeek.map((d) => d.state));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!saving) setLocal(nextWeek.map((d) => d.state)); }, [nextWeek, saving]);

  // Treat missing / 0 conditions as "no cap" so screen stays usable.
  const required = potNext && potNext.required_pledges > 0 ? potNext.required_pledges : 7;
  const stakePerMiss = potNext?.stake_per_miss ?? 0;
  const sel = local.filter((s) => s === 'planned' || s === 'locked').length;
  const atCap = sel >= required;
  const overCap = sel > required;
  const overBy = Math.max(0, sel - required);
  const editableDays: DayStatus[] = local.map((state, i) => ({ day: LABELS[i], state }));
  const myPlannedDows = local
    .map((s, i) => ((s === 'planned' || s === 'locked') ? i : -1))
    .filter((i) => i !== -1);

  const toggle = (i: number) => {
    setLocal((arr) => arr.map((s, idx) => {
      if (idx !== i) return s;
      if (s === 'checked-in' || s === 'missed') return s;
      if (s === 'unselected' && atCap) return s;
      return (s === 'planned' || s === 'locked') ? 'unselected' : 'planned';
    }));
  };

  const commit = async () => {
    if (overCap) { showToast(`Remove ${overBy} ${overBy === 1 ? 'day' : 'days'} first`, 'info'); return; }
    setSaving(true);
    try {
      const days = local
        .map((s, i) => ((s === 'planned' || s === 'locked') ? i : -1))
        .filter((i): i is number => i !== -1);
      await setPlannedDays(days);
      showToast(days.length === 0 ? 'Pledges cleared' : 'Pledges saved', 'success');
      onDone();
    } finally { setSaving(false); }
  };

  const otherMembers = groupMembers.filter((m) => m.userId !== userId);

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView contentContainerStyle={[pageWrap, { paddingBottom: 160 }]} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View style={styles.rowBetween}>
            <View>
              <Eyebrow>{groupName || 'Solo'}</Eyebrow>
              <H1 style={{ marginTop: 6 }}>Plan next week</H1>
            </View>
            <Pressable onPress={onCancel} style={styles.closeBtn}>
              <MaterialIcons name="close" size={20} color={C.ink} />
            </Pressable>
          </View>
          <Sub style={{ marginTop: 10 }}>
            Pledging is optional. Pick up to {required} {required === 1 ? 'day' : 'days'} — edit any time before Sunday.
          </Sub>
        </FadeInItem>

        {isNextSetter && (
          <FadeInItem delay={80} style={{ marginTop: 24 }}>
            <PotConditionsEditor potNext={potNext} onSave={updatePotConditions} />
          </FadeInItem>
        )}
        {!isNextSetter && potNext && (
          <FadeInItem delay={80} style={{ marginTop: 24 }}>
            <Card padding={SPACE.lg} tone="default">
              <View style={styles.rowGap}>
                <View style={[styles.iconChip, { backgroundColor: C.successSoft }]}>
                  <MaterialIcons name="gavel" size={18} color={C.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <H3>Next week's pot rules</H3>
                  <Sub style={{ marginTop: 2 }}>
                    {potNext.setter_display_name || 'A group member'} is this week's rule setter (the role rotates weekly): {potNext.required_pledges} {potNext.required_pledges === 1 ? 'pledge' : 'pledges'} · {(potNext.required_pledges * potNext.stake_per_miss).toLocaleString()} ELO at stake ({potNext.stake_per_miss} per miss).
                  </Sub>
                </View>
              </View>
            </Card>
          </FadeInItem>
        )}

        <FadeInItem delay={140} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <View style={[styles.rowBetween, { marginBottom: 16 }]}>
              <Eyebrow>Your days</Eyebrow>
              <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: overCap ? C.accent : C.success }}>{sel} / {required}</Text>
            </View>
            <DayPicker days={editableDays} editable onToggle={toggle} />
            {overCap && (
              <Sub style={{ marginTop: 14, color: C.accent }}>
                You've pledged {overBy} more than this week's cap. Remove {overBy} to save.
              </Sub>
            )}
            <View style={styles.divider} />
            <Eyebrow>Your stake</Eyebrow>
            <Num style={{ marginTop: 6 }}>{(sel * stakePerMiss).toLocaleString()} ELO</Num>
            <Sub style={{ marginTop: 4 }}>
              {sel === 0
                ? 'Pledge any number of days to enter the pot.'
                : `${stakePerMiss.toLocaleString()} ELO lost per missed session.`}
            </Sub>
          </Card>
        </FadeInItem>

        {otherMembers.length > 0 && (
          <FadeInItem delay={180} style={{ marginTop: 22 }}>
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <Eyebrow>Group's next-week pledges</Eyebrow>
              <Sub>{otherMembers.length} {otherMembers.length === 1 ? 'member' : 'members'}</Sub>
            </View>
            <Sub style={{ marginBottom: 12 }}>
              Days you've picked are highlighted across the group — that's everyone you're joining.
            </Sub>
            <View style={{ gap: 10 }}>
              {otherMembers.map((m) => (
                <Card key={m.userId} padding={SPACE.lg}>
                  <View style={[styles.rowGap, { marginBottom: 12 }]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{m.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{m.name}</Text>
                      <Sub style={{ marginTop: 2 }}>
                        {m.nextWeek.filter((d) => d.state === 'planned' || d.state === 'locked').length} planned
                      </Sub>
                    </View>
                    {m.isLeader && <Chip text="Leader" tone="accent" compact />}
                  </View>
                  <MemberPlanRow days={m.nextWeek} highlightDows={myPlannedDows} />
                </Card>
              ))}
            </View>
          </FadeInItem>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          label={saving ? 'Saving…' : overCap ? `Remove ${overBy} to save` : 'Save'}
          loading={saving}
          disabled={saving || overCap}
          onPress={commit}
        />
      </View>
    </View>
  );
}

/** Read-only day row that highlights specific weekday columns the viewer cares about. */
function MemberPlanRow({ days, highlightDows }: { days: DayStatus[]; highlightDows: number[] }) {
  const highlight = new Set(highlightDows);
  const pledged = days.some((d) => d.state === 'planned' || d.state === 'locked' || d.state === 'checked-in' || d.state === 'missed');
  return (
    <View style={{ flexDirection: 'row', gap: 6, opacity: pledged ? 1 : 0.4 }}>
      {days.map((d, i) => {
        const matched = highlight.has(i);
        const isPlanned = d.state === 'planned' || d.state === 'locked';
        const isDone = d.state === 'checked-in';
        const isMissed = d.state === 'missed';
        const bg = matched && isPlanned ? C.primary
          : isDone ? C.success
          : isPlanned ? 'transparent'
          : isMissed ? C.dangerSoft
          : 'transparent';
        const fg = matched && isPlanned ? C.primaryFg
          : isPlanned ? C.success
          : isDone ? C.primaryFg
          : isMissed ? C.danger
          : C.mutedFg;
        const border = matched && isPlanned ? C.primary
          : isPlanned ? C.success
          : isDone ? C.success
          : isMissed ? C.dangerSoft
          : C.border;
        return (
          <View
            key={i}
            style={{
              flex: 1, minWidth: 32, height: 48, borderRadius: RADIUS.md,
              alignItems: 'center', justifyContent: 'center', gap: 2,
              backgroundColor: bg,
              borderWidth: isPlanned && !matched ? 2 : 1,
              borderColor: border,
            }}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, color: fg, letterSpacing: 0.5 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
            </Text>
            {isPlanned && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />}
            {isDone && <MaterialIcons name="check" size={12} color={fg} />}
            {isMissed && <MaterialIcons name="close" size={12} color={fg} />}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Editor for next-week pot rules, shown only to the current rotational rule
 * setter. Visibility is controlled by the caller (PlanWeek renders this only
 * when the logged-in user is next week's setter).
 */
function PotConditionsEditor({
  potNext, onSave,
}: {
  potNext: import('../../lib/api/pot').PotDetail | null;
  onSave: (week: 'current' | 'next', required: number, stake: number) => Promise<void>;
}) {
  const initialRequired = potNext && potNext.required_pledges > 0 ? potNext.required_pledges : 3;
  const initialTotal = potNext && potNext.required_pledges > 0
    ? potNext.required_pledges * potNext.stake_per_miss
    : 300;
  const [required, setRequired] = useState(String(initialRequired));
  const [total, setTotal] = useState(String(initialTotal));
  useEffect(() => {
    setRequired(String(initialRequired));
    setTotal(String(initialTotal));
  }, [initialRequired, initialTotal]);

  const reqNum = Math.max(1, Math.min(7, parseInt(required, 10) || 1));
  const perMiss = Math.round((parseInt(total, 10) || 0) / reqNum);

  const save = () => {
    // Stake per missed session is derived from the full weekly amount / sessions.
    onSave('next', reqNum, perMiss);
  };

  return (
    <Card padding={SPACE.xl} tone="sage">
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Your turn this week</Eyebrow>
          <H3 style={{ marginTop: 4 }}>Next week's pot rules</H3>
          <Sub style={{ marginTop: 4 }}>The rule setter rotates weekly — it's your turn to set next week's conditions.</Sub>
        </View>
        <Chip text="Rule setter" tone="success" icon="autorenew" compact />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Sessions / week</Eyebrow>
          <TextInput value={required} onChangeText={(t) => setRequired(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} />
          <Sub style={{ marginTop: 4, fontSize: 11 }}>1–7 days</Sub>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>Weekly stake</Eyebrow>
          <TextInput value={total} onChangeText={(t) => setTotal(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} />
          <Sub style={{ marginTop: 4, fontSize: 11 }}>Total ELO · {perMiss} per miss</Sub>
        </View>
      </View>
      <Btn label="Save rules" size="md" onPress={save} style={{ marginTop: 14 }} />
    </Card>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ Group view — members + per-day join                      │
   ╰─────────────────────────────────────────────────────────╯ */

export function GroupView({ onBrowse }: { onBrowse: () => void }) {
  const { groupName, groupMembers, refreshGroupsAtGym, potNext, userId } = useAppState();
  const refresh = useRefreshControl();
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);
  const setterName = potNext?.setter_user_id === userId ? 'You' : potNext?.setter_display_name;

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
            {groupMembers.map((m, i) => {
              const pledged = m.thisWeek.filter((d) => d.state !== 'unselected').length;
              const done = m.thisWeek.filter((d) => d.state === 'checked-in').length;
              const notPledging = pledged === 0;
              return (
                <FadeInItem key={m.userId} delay={140 + i * 60}>
                  <Card padding={SPACE.lg} style={notPledging ? { opacity: 0.55 } : undefined}>
                    <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                      <View style={styles.rowGap}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{m.initials}</Text>
                        </View>
                        <View>
                          <Text style={styles.cardTitle}>{m.name}</Text>
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

/* ╭─────────────────────────────────────────────────────────╮
   │ NoGroup — empty state                                    │
   ╰─────────────────────────────────────────────────────────╯ */

export function NoGroup({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl }}>
        <View style={styles.bigCheck}>
          <MaterialIcons name="group" size={48} color={C.accent} />
        </View>
        <FadeInItem delay={100} style={{ alignItems: 'center', marginTop: 24 }}>
          <H1 style={{ textAlign: 'center' }}>Join a group</H1>
          <Sub style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
            You're at your gym but not in a group yet. Find one to start the weekly challenge.
          </Sub>
        </FadeInItem>
        <FadeInItem delay={200} style={{ width: '100%', marginTop: 32 }}>
          <Btn label="Browse groups" onPress={onBrowse} icon="search" />
        </FadeInItem>
      </View>
    </View>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ Gym browser — list + create + leader inbox               │
   ╰─────────────────────────────────────────────────────────╯ */

export function GymBrowser({ onBack, onJoined, onCreated }: { onBack: () => void; onJoined: () => void; onCreated: () => void }) {
  const { groupId, groups, addGroup, joinGroup, leaveGroup, joinRequests, approveRequest, rejectRequest, refreshGroupsAtGym } = useAppState();
  const refresh = useRefreshControl();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [freq, setFreq] = useState('3');           // required_pledges per week, 1..7
  const [weeklyStake, setWeeklyStake] = useState('300');  // full ELO at stake for the week
  const [jt, setJt] = useState<'open' | 'request'>('open');
  const [inbox, setInbox] = useState(false);
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
            {joinRequests.length > 0 && (
              <Pressable onPress={() => setInbox((s) => !s)} style={styles.inboxBtn}>
                <MaterialIcons name="notifications" size={18} color={C.accent} />
                <Text style={{ fontFamily: FONT.semibold, color: C.accent, marginLeft: 6 }}>{joinRequests.length}</Text>
              </Pressable>
            )}
          </View>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>All groups · any gym</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Browse groups</H1>
          <Sub style={{ marginTop: 6 }}>Groups are global — join friends from any gym.</Sub>
        </FadeInItem>

        {inbox && joinRequests.length > 0 && (
          <FadeInItem delay={100} style={{ marginTop: 18 }}>
            <Card padding={SPACE.lg} tone="peach">
              <Eyebrow style={{ color: C.accent, marginBottom: 10 }}>JOIN REQUESTS</Eyebrow>
              <View style={{ gap: 10 }}>
                {joinRequests.map((req) => (
                  <View key={req.id} style={styles.rowBetween}>
                    <View style={styles.rowGap}>
                      <View style={[styles.avatar, { width: 32, height: 32 }]}>
                        <Text style={[styles.avatarText, { fontSize: 11 }]}>{req.userName.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <Text style={{ fontFamily: FONT.semibold, color: C.ink, fontSize: 14 }}>{req.userName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => { approveRequest(req.id); if (joinRequests.length === 1) setInbox(false); }} style={[styles.miniBtn, { backgroundColor: C.success }]}>
                        <MaterialIcons name="check" size={16} color={C.primaryFg} />
                      </Pressable>
                      <Pressable onPress={() => { rejectRequest(req.id); if (joinRequests.length === 1) setInbox(false); }} style={[styles.miniBtn, { backgroundColor: C.muted }]}>
                        <MaterialIcons name="close" size={16} color={C.inkSoft} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </FadeInItem>
        )}

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

/* ╭─────────────────────────────────────────────────────────╮
   │ Pot tracker — conditions + member breakdown              │
   ╰─────────────────────────────────────────────────────────╯ */

export function PotTracker({ onBack }: { onBack: () => void }) {
  const { potCurrent } = useAppState();
  const refresh = useRefreshControl();

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
          <Text style={styles.megaNumber}>{potCurrent.total_pot_elo.toLocaleString()}</Text>
          <Sub style={{ marginTop: -4 }}>ELO in the pot · {totalAtStake.toLocaleString()} at stake</Sub>
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
              <RuleRow label="Stake per miss" value={`${potCurrent.stake_per_miss} ELO`} />
              <RuleRow label="Total at risk / person" value={`${(potCurrent.required_pledges * potCurrent.stake_per_miss).toLocaleString()} ELO`} accent />
            </View>
            <Sub style={{ marginTop: 18 }}>
              {potCurrent.is_practice
                ? 'Practice week — no ELO at stake. The real pot starts next week.'
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
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(m.display_name || '?').slice(0, 2).toUpperCase()}</Text>
                      </View>
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
                      text={m.is_on_track ? 'On track' : `${m.elo_lost_so_far.toLocaleString()}`}
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

/* ╭─────────────────────────────────────────────────────────╮
   │ Progress — ELO ladder + badges                           │
   ╰─────────────────────────────────────────────────────────╯ */

type BadgeKey = keyof import('../../lib/api/badges').Badges;
const BADGE_CATALOG: { key: BadgeKey; name: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'first_week',       name: 'First Week',       icon: 'flag' },
  { key: 'streak_master',    name: 'Streak Master',    icon: 'local-fire-department' },
  { key: 'early_bird',       name: 'Early Bird',       icon: 'wb-sunny' },
  { key: 'consistency_king', name: 'Consistency King', icon: 'workspace-premium' },
  { key: 'pot_winner',       name: 'Pot Winner',       icon: 'paid' },
  { key: 'group_leader',     name: 'Group Leader',     icon: 'group' },
];

const TIERS = [
  { name: 'Beginner', min: 0,    max: 500,      icon: 'fitness-center' as const },
  { name: 'Rookie',   min: 500,  max: 1000,     icon: 'directions-run' as const },
  { name: 'Regular',  min: 1000, max: 2000,     icon: 'sports-martial-arts' as const },
  { name: 'Mogger',   min: 2000, max: Infinity, icon: 'military-tech' as const },
];

export function Progress({ onGymSpace }: { onGymSpace: () => void }) {
  const { elo, badges: badgeFlags } = useAppState();
  const refresh = useRefreshControl();
  const ti = TIERS.findIndex((t) => elo >= t.min && elo < t.max);
  const cur = TIERS[ti] ?? TIERS[0];
  const next = TIERS[ti + 1];
  const pct = next ? ((elo - cur.min) / (next.min - cur.min)) * 100 : 100;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Progress</Eyebrow>
          <H1 style={{ marginTop: 6 }}>{cur.name}</H1>
          <Sub style={{ marginTop: 6 }}>Track your growth and unlock rewards</Sub>
        </FadeInItem>

        <FadeInItem delay={100} style={{ marginTop: 24 }}>
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

        <FadeInItem delay={520} style={{ marginTop: 24 }}>
          <Card onPress={onGymSpace} padding={SPACE.lg} tone="peach">
            <View style={styles.rowBetween}>
              <View style={[styles.rowGap, { flex: 1 }]}>
                <View style={[styles.iconChip, { backgroundColor: 'rgba(232,155,124,0.20)' }]}>
                  <MaterialIcons name="grid-view" size={20} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <H3>Your gym space</H3>
                  <Sub style={{ marginTop: 2 }}>Decorate with what you've unlocked</Sub>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={C.inkSoft} />
            </View>
          </Card>
        </FadeInItem>
      </ScrollView>
    </View>
  );
}

/* ╭─────────────────────────────────────────────────────────╮
   │ Gym space — decoration grid                              │
   ╰─────────────────────────────────────────────────────────╯ */

interface SpaceItemDef { id: string; name: string; emoji: string; unlockElo: number; }
const ROOM_ITEMS: SpaceItemDef[] = [
  { id: 'mat',    name: 'Yoga Mat',    emoji: '🧘', unlockElo: 0 },
  { id: 'db',     name: 'Dumbbells',   emoji: '🏋️', unlockElo: 0 },
  { id: 'plant',  name: 'Plant',       emoji: '🪴', unlockElo: 500 },
  { id: 'bench',  name: 'Bench',       emoji: '🛋️', unlockElo: 500 },
  { id: 'banner', name: 'Banner',      emoji: '🏆', unlockElo: 1000 },
  { id: 'tread',  name: 'Treadmill',   emoji: '🏃', unlockElo: 1000 },
  { id: 'neon',   name: 'Neon Sign',   emoji: '💡', unlockElo: 1200 },
  { id: 'ring',   name: 'Boxing Ring', emoji: '🥊', unlockElo: 2000 },
  { id: 'mascot', name: 'Mascot',      emoji: '🐯', unlockElo: 2000 },
];

export function GymSpace({ onBack }: { onBack: () => void }) {
  const { elo, roomItems, placeRoomItem } = useAppState();
  const placementByItem = new Map(roomItems.map((r) => [r.item_id, r.slot] as const));
  const placedSlots = new Set(roomItems.map((r) => r.slot));

  const unlocked = (it: SpaceItemDef) => elo >= it.unlockElo;
  const freeSlot = () => { for (let s = 0; s < 9; s++) if (!placedSlots.has(s)) return s; return null; };
  const toggle = (it: SpaceItemDef) => {
    if (!unlocked(it)) return;
    if (placementByItem.has(it.id)) { placeRoomItem(it.id, null); return; }
    const f = freeSlot(); if (f === null) return;
    placeRoomItem(it.id, f);
  };

  return (
    <View style={styles.screen}>
      <BlobBackground variant="progress" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Pressable onPress={onBack} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={20} color={C.ink} />
          </Pressable>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>Your space</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Decorate your gym</H1>
          <Sub style={{ marginTop: 6 }}>Earn rewards by levelling up, then place them</Sub>
        </FadeInItem>

        <FadeInItem delay={120} style={{ marginTop: 24 }}>
          <Card padding={SPACE.md}>
            <View style={styles.roomGrid}>
              {Array.from({ length: 9 }).map((_, slot) => {
                const placement = roomItems.find((r) => r.slot === slot);
                const def = placement && ROOM_ITEMS.find((i) => i.id === placement.item_id);
                return (
                  <View key={slot} style={styles.roomCell}>
                    <View style={[styles.roomTile, def ? { backgroundColor: C.cardHi, borderColor: C.border, borderWidth: 0 } : null]}>
                      {def && <Text style={{ fontSize: 32 }}>{def.emoji}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
            <Sub style={{ textAlign: 'center', marginTop: 12 }}>Tap an item to place · tap a placed item to remove</Sub>
          </Card>
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 22 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Items</Eyebrow>
        </FadeInItem>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {ROOM_ITEMS.map((it, i) => {
            const on = unlocked(it);
            const isPlaced = placementByItem.has(it.id);
            return (
              <FadeInItem key={it.id} delay={220 + i * 40} style={{ width: '31%' }}>
                <Pressable
                  disabled={!on}
                  onPress={() => toggle(it)}
                  style={[styles.itemTile, { opacity: on ? 1 : 0.45 }]}
                >
                  <Text style={{ fontSize: 30 }}>{it.emoji}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  {!on && (
                    <View style={styles.lockBadge}>
                      <MaterialIcons name="lock" size={9} color={C.mutedFg} />
                      <Text style={styles.lockText}>{it.unlockElo}</Text>
                    </View>
                  )}
                  {on && isPlaced && (
                    <View style={styles.placedBadge}>
                      <MaterialIcons name="check" size={11} color={C.primaryFg} />
                    </View>
                  )}
                </Pressable>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────  Styles  ───────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  cardTitle: { fontFamily: FONT.bold, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  h2: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.3, lineHeight: 28, marginTop: 4 },
  // Pledge Overview card: "This week" is now the prominent header; "Your pledge" is de-emphasized.
  thisWeekHeader: { fontFamily: FONT.extra, fontSize: 20, color: C.ink, letterSpacing: -0.3, textTransform: 'none' },
  pledgeSubhead: { fontFamily: FONT.regular, fontSize: 14, color: C.mutedFg, letterSpacing: 0, marginTop: 3 },

  eyebrowOnCream: { fontFamily: FONT.bold, fontSize: 11, color: 'rgba(27,23,20,0.55)', letterSpacing: 0.8, textTransform: 'uppercase' },
  subOnCream: { fontFamily: FONT.medium, fontSize: 13, color: 'rgba(27,23,20,0.65)' },
  potValue: { fontFamily: FONT.extra, fontSize: 36, color: C.primaryFg, letterSpacing: -0.8, marginTop: 8 },
  potUnit: { fontFamily: FONT.semibold, fontSize: 16, color: C.primaryFg },
  creamArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(27,23,20,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  devControls: {
    position: 'absolute', top: 48, right: SPACE.xl, zIndex: 5,
    gap: 6,
  },
  devControlRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  devClockBtn: {
    width: 118, height: 32, borderRadius: RADIUS.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: C.ink,
    paddingHorizontal: 8,
  },
  devClockBtnDisabled: { opacity: 0.38 },
  devClockBtnText: { fontFamily: FONT.semibold, fontSize: 10.5, color: C.primaryFg, letterSpacing: 0 },

  iconChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },
  iconBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },

  footer: {
    padding: SPACE.xl, paddingBottom: 32,
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border,
  },

  bigCheck: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.successSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(156,181,143,0.35)',
  },

  divider: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 18, paddingTop: 18 },

  input: {
    height: 48, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.semibold, fontSize: 15,
    marginTop: 6,
  },

  tabBar: { flexDirection: 'row', gap: 6, backgroundColor: C.card, borderRadius: RADIUS.pill, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: 'center' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontFamily: FONT.semibold, fontSize: 13 },

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.ink, fontFamily: FONT.bold, fontSize: 13 },

  inboxBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: C.accentSoft,
  },
  miniBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: RADIUS.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi },
  linkText: { fontFamily: FONT.semibold, fontSize: 13, color: C.ink },
  jtOpt: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderHi, backgroundColor: C.bgSoft },
  dot: { color: C.mutedFg, fontSize: 14 },

  megaNumber: { fontFamily: FONT.extra, fontSize: 56, color: C.ink, letterSpacing: -1.4, lineHeight: 64 },
  ruleValue: { fontFamily: FONT.bold, fontSize: 16, color: C.ink, letterSpacing: -0.2 },

  progressTrack: { height: 8, backgroundColor: C.muted, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },

  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACE.lg },
  ladderIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeName: { fontFamily: FONT.semibold, fontSize: 11, color: C.ink, textAlign: 'center', letterSpacing: 0.1 },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', aspectRatio: 1, backgroundColor: C.bgSoft, borderRadius: RADIUS.lg, padding: 6 },
  roomCell: { width: '33.33%', aspectRatio: 1, padding: 5 },
  roomTile: { flex: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.border, borderStyle: 'dashed' },

  itemTile: { aspectRatio: 1, backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  itemName: { fontFamily: FONT.medium, fontSize: 11, color: C.inkSoft, textAlign: 'center' },
  lockBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.muted, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  lockText: { fontFamily: FONT.semibold, fontSize: 9, color: C.mutedFg },
  placedBadge: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, backgroundColor: C.success, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
