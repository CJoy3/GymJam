import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, H3, IconButton, Num, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { DayPicker } from '../ui/DayPicker';
import { Slider } from '../ui/Slider';
import { BlobBackground } from '../ui/Blob';
import { showToast } from '../ui/toast';
import { useAppState, DayStatus } from '../state/AppState';
import { LABELS, pageWrap, styles } from './_shared';

/* Plan next week-local state + PotConditionsEditor */

export function PlanWeek({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const {
    nextWeek, setPlannedDays, groupName, potNext, updatePotConditions,
    userId, groupMembers, todayDow, nextStakeType, isLeader, joinType, updateStakeType,
    elo, money,
  } = useAppState();
  // PlanWeek is about NEXT week, so it shows/edits next week's currency.
  const isMoney = nextStakeType === 'money';
  const [changingStakeType, setChangingStakeType] = useState(false);
  const canChangeStakeType = isLeader && joinType === 'request';
  // The pot type, like the pot rules, can only be changed on Monday-after
  // that it's locked in for next week.
  const isMonday = todayDow === 0;
  // For money groups stake_per_miss is pence; show it as £. For ELO it's points.
  const fmtStake = (amount: number) =>
    isMoney ? `£${(amount / 100).toFixed(2)}` : `${amount.toLocaleString()} ELO`;
  // The rule setter rotates weekly-only the setter for next week may edit it.
  const isNextSetter = !!potNext && potNext.setter_user_id != null && potNext.setter_user_id === userId;
  const [local, setLocal] = useState<DayStatus['state'][]>(() => nextWeek.map((d) => d.state));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!saving) setLocal(nextWeek.map((d) => d.state)); }, [nextWeek, saving]);

  // Treat missing / 0 conditions as "no cap" so screen stays usable.
  const required = potNext && potNext.required_pledges > 0 ? potNext.required_pledges : 7;
  const stakePerMiss = potNext?.stake_per_miss ?? 0;
  // You can only pledge as many days as you can fully cover: each pledged day
  // risks stakePerMiss of your balance (ELO points or money pence). Practice
  // weeks / zero-stake pots are unconstrained.
  const balance = isMoney ? money : elo;
  const isPractice = !!potNext?.is_practice;
  const maxAffordable = !isPractice && stakePerMiss > 0 ? Math.floor(balance / stakePerMiss) : 7;
  const limitedByFunds = maxAffordable < required;
  // The binding limit is the tighter of the pot rule and what you can afford.
  const cap = Math.min(required, maxAffordable);
  const sel = local.filter((s) => s === 'planned' || s === 'locked').length;
  const atCap = sel >= cap;
  const overCap = sel > cap;
  const overBy = Math.max(0, sel - cap);
  const editableDays: DayStatus[] = local.map((state, i) => ({ day: LABELS[i], state }));
  const myPlannedDows = local
    .map((s, i) => ((s === 'planned' || s === 'locked') ? i : -1))
    .filter((i) => i !== -1);

  const toggle = (i: number) => {
    const turningOn = local[i] === 'unselected';
    if (turningOn && atCap && limitedByFunds && sel >= maxAffordable) {
      showToast(
        maxAffordable === 0
          ? `Not enough ${isMoney ? 'funds' : 'ELO'} to pledge at ${fmtStake(stakePerMiss)} per miss`
          : `You can only afford ${maxAffordable} ${maxAffordable === 1 ? 'day' : 'days'} at ${fmtStake(stakePerMiss)} each`,
        'info',
      );
      return;
    }
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
            <IconButton icon="close" onPress={onCancel} />
          </View>
          <Sub style={{ marginTop: 10 }}>
            Pledging is optional. Pick up to {required} {required === 1 ? 'day' : 'days'}-edit any time before Sunday.
          </Sub>
        </FadeInItem>

        {isNextSetter && (
          <FadeInItem delay={80} style={{ marginTop: 24 }}>
            <PotConditionsEditor potNext={potNext} onSave={updatePotConditions} isMonday={todayDow === 0} isMoney={isMoney} balance={balance} />
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
                    {potNext.setter_display_name || 'A group member'} is this week's rule setter (the role rotates weekly): {potNext.required_pledges} {potNext.required_pledges === 1 ? 'pledge' : 'pledges'} · {fmtStake(potNext.required_pledges * potNext.stake_per_miss)} at stake ({fmtStake(potNext.stake_per_miss)} per miss).
                  </Sub>
                </View>
              </View>
            </Card>
          </FadeInItem>
        )}

        {canChangeStakeType && (
          <FadeInItem delay={120} style={{ marginTop: 14 }}>
            <Card padding={SPACE.lg}>
              <View style={[styles.rowGap, { marginBottom: 12 }]}>
                <View style={[styles.iconChip, { backgroundColor: isMoney ? 'rgba(156,181,143,0.15)' : 'rgba(199,160,110,0.15)' }]}>
                  <MaterialIcons
                    name={isMoney ? 'account-balance-wallet' : 'emoji-events'}
                    size={18}
                    color={isMoney ? C.success : C.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <H3>Pot type</H3>
                  <Sub style={{ marginTop: 2 }}>
                    {isMonday ? 'Takes effect from next week' : 'Locked-can only be changed on Monday'}
                  </Sub>
                </View>
                {!isMonday && <MaterialIcons name="lock" size={18} color={C.mutedFg} />}
              </View>
              {isMonday ? (
                /* Editable-Monday only */
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[stakeToggleBtn, !isMoney && stakeToggleBtnOn]}
                    disabled={changingStakeType}
                    onPress={async () => {
                      if (isMoney) {
                        setChangingStakeType(true);
                        try { await updateStakeType('elo'); } finally { setChangingStakeType(false); }
                      }
                    }}
                  >
                    <MaterialIcons name="emoji-events" size={15} color={!isMoney ? C.primaryFg : C.mutedFg} />
                    <Text style={[stakeToggleText, { color: !isMoney ? C.primaryFg : C.mutedFg }]}>ELO</Text>
                  </Pressable>
                  <Pressable
                    style={[stakeToggleBtn, isMoney && stakeToggleBtnOn]}
                    disabled={changingStakeType}
                    onPress={async () => {
                      if (!isMoney) {
                        setChangingStakeType(true);
                        try { await updateStakeType('money'); } finally { setChangingStakeType(false); }
                      }
                    }}
                  >
                    <MaterialIcons name="account-balance-wallet" size={15} color={isMoney ? C.primaryFg : C.mutedFg} />
                    <Text style={[stakeToggleText, { color: isMoney ? C.primaryFg : C.mutedFg }]}>Money</Text>
                  </Pressable>
                </View>
              ) : (
                /* Locked-read-only display of next week's chosen type */
                <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 0 }]}>
                  <MaterialIcons
                    name={isMoney ? 'account-balance-wallet' : 'emoji-events'}
                    size={16}
                    color={isMoney ? C.success : C.accent}
                  />
                  <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: C.ink }}>
                    {isMoney ? 'Money pot' : 'ELO pot'}
                  </Text>
                </View>
              )}
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
                {sel > maxAffordable
                  ? `You can only cover ${maxAffordable} ${maxAffordable === 1 ? 'day' : 'days'} (${fmtStake(stakePerMiss)} each). Remove ${overBy} to save.`
                  : `You've pledged ${overBy} more than this week's cap. Remove ${overBy} to save.`}
              </Sub>
            )}
            {!overCap && limitedByFunds && (
              <Sub style={{ marginTop: 14, color: C.mutedFg }}>
                Your balance covers up to {maxAffordable} {maxAffordable === 1 ? 'day' : 'days'} at {fmtStake(stakePerMiss)} per miss.
              </Sub>
            )}
            <View style={styles.divider} />
            <Eyebrow>Your stake</Eyebrow>
            <Num style={{ marginTop: 6 }}>{fmtStake(sel * stakePerMiss)}</Num>
            <Sub style={{ marginTop: 4 }}>
              {sel === 0
                ? 'Pledge any number of days to enter the pot.'
                : `${fmtStake(stakePerMiss)} lost per missed session.`}
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
              Days you've picked are highlighted across the group-that's everyone you're joining.
            </Sub>
            <View style={{ gap: 10 }}>
              {otherMembers.map((m) => (
                <Card key={m.userId} padding={SPACE.lg}>
                  <View style={[styles.rowGap, { marginBottom: 12 }]}>
                    <Avatar id={m.avatar} name={m.name} size={40} />
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
 * setter. Only editable on Monday-after that the conditions are locked.
 */
/** Hard cap on ELO staked per missed session-mirrors the backend's ELO_STAKE_CAP. */
const ELO_STAKE_CAP = 500;

function PotConditionsEditor({
  potNext, onSave, isMonday, isMoney, balance,
}: {
  potNext: import('../../lib/api/pot').PotDetail | null;
  onSave: (week: 'current' | 'next', required: number, stake: number) => Promise<void>;
  isMonday: boolean;
  isMoney: boolean;
  balance: number;
}) {
  const initialRequired = potNext && potNext.required_pledges > 0 ? potNext.required_pledges : 3;
  const initialTotal = potNext && potNext.required_pledges > 0
    ? potNext.required_pledges * potNext.stake_per_miss
    : (isMoney ? 500 : 300);  // money: pence (£5 default); elo: 300
  const [required, setRequired] = useState(String(initialRequired));
  const [total, setTotal] = useState(String(initialTotal));
  // Money weekly stake in whole £ (1–20), kept in sync with `total` (pence).
  const [moneyStake, setMoneyStake] = useState(Math.max(1, Math.min(20, Math.round(initialTotal / 100))));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setRequired(String(initialRequired));
    setTotal(String(initialTotal));
    setMoneyStake(Math.max(1, Math.min(20, Math.round(initialTotal / 100))));
    setSaved(false);
  }, [initialRequired, initialTotal]);

  const reqNum = Math.max(1, Math.min(7, parseInt(required, 10) || 1));
  const weeklyTotal = isMoney ? moneyStake * 100 : (parseInt(total, 10) || 0);
  const perMiss = Math.round(weeklyTotal / reqNum);
  const fmtStake = (amount: number) =>
    isMoney ? `£${(amount / 100).toFixed(2)}` : `${amount.toLocaleString()} ELO`;

  // The rules you set must be valid: ELO per-miss is capped, and you must be able
  // to cover the full weekly stake (reqNum × perMiss) in the pot's currency.
  const overEloCap = !isMoney && perMiss > ELO_STAKE_CAP;
  const unaffordable = reqNum * perMiss > balance;
  const ruleError = overEloCap
    ? `Max ${ELO_STAKE_CAP} ELO per miss-lower the weekly stake or add days.`
    : unaffordable
      ? `You can't cover ${fmtStake(reqNum * perMiss)}. Your balance is ${fmtStake(balance)}.`
      : null;

  const save = async () => {
    if (ruleError) { showToast(ruleError, 'info'); return; }
    setSaving(true);
    try {
      await onSave('next', reqNum, perMiss);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding={SPACE.xl} tone="sage">
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Your turn this week</Eyebrow>
          <H3 style={{ marginTop: 4 }}>Next week's pot rules</H3>
          <Sub style={{ marginTop: 4 }}>
            {isMonday
              ? "The rule setter rotates weekly-it's your turn to set next week's conditions."
              : 'Rules can only be set on Monday. These conditions are now locked for next week.'}
          </Sub>
        </View>
        <Chip text="Rule setter" tone="success" icon="autorenew" compact />
      </View>

      {!isMonday ? (
        /* Locked-read-only display */
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Sessions / week</Eyebrow>
            <View style={[styles.input, { justifyContent: 'center' }]}>
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: C.ink }}>{reqNum}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow>Weekly stake</Eyebrow>
            <View style={[styles.input, { justifyContent: 'center' }]}>
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: C.ink }}>{fmtStake(reqNum * perMiss)}</Text>
            </View>
          </View>
        </View>
      ) : (
        /* Editable-Monday only */
        <>
          <View>
            <Eyebrow>Sessions / week</Eyebrow>
            <TextInput
              value={required}
              onChangeText={(t) => { setRequired(t.replace(/[^0-9]/g, '')); setSaved(false); }}
              keyboardType="number-pad"
              style={styles.input}
            />
            <Sub style={{ marginTop: 4, fontSize: 11 }}>1–7 days</Sub>
          </View>
          <View style={{ marginTop: 14 }}>
            <View style={styles.rowBetween}>
              <Eyebrow>Weekly stake</Eyebrow>
              {isMoney && <Text style={{ fontFamily: FONT.bold, fontSize: 16, color: C.ink }}>£{moneyStake}</Text>}
            </View>
            {isMoney ? (
              <>
                <Slider min={1} max={20} value={moneyStake} onChange={(v) => { setMoneyStake(v); setSaved(false); }} />
                <Sub style={{ fontSize: 11 }}>£1–£20 for the week · {fmtStake(perMiss)} per miss</Sub>
              </>
            ) : (
              <>
                <TextInput
                  value={total}
                  onChangeText={(t) => { setTotal(t.replace(/[^0-9]/g, '')); setSaved(false); }}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <Sub style={{ marginTop: 4, fontSize: 11 }}>Total ELO · {perMiss} per miss · max {ELO_STAKE_CAP} per miss</Sub>
              </>
            )}
          </View>
          {ruleError && (
            <Sub style={{ marginTop: 12, color: C.accent }}>{ruleError}</Sub>
          )}
          {saved ? (
            <View style={savedBtnStyle}>
              <MaterialIcons name="check-circle" size={18} color={C.success} />
              <Text style={savedBtnText}>Rules saved</Text>
            </View>
          ) : (
            <Btn label={saving ? 'Saving…' : 'Save rules'} size="md" loading={saving} disabled={saving || !!ruleError} onPress={save} style={{ marginTop: 14 }} />
          )}
        </>
      )}
    </Card>
  );
}

const stakeToggleBtn: import('react-native').ViewStyle = {
  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  paddingVertical: 10, borderRadius: RADIUS.md,
  backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
};
const stakeToggleBtnOn: import('react-native').ViewStyle = {
  backgroundColor: C.primary, borderColor: C.primary,
};
const stakeToggleText: import('react-native').TextStyle = {
  fontFamily: FONT.semibold, fontSize: 14,
};

const savedBtnStyle: import('react-native').ViewStyle = {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  marginTop: 14, height: 44, borderRadius: RADIUS.md,
  backgroundColor: 'rgba(156,181,143,0.18)',
  borderWidth: 1, borderColor: 'rgba(156,181,143,0.35)',
};
const savedBtnText: import('react-native').TextStyle = {
  fontFamily: FONT.semibold, fontSize: 14, color: C.success,
};
