import React, { useEffect, useState } from 'react';
import { Alert, View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Card, Btn, Chip, H1, Sub, Ring } from '../ui/components';
import { DayPicker, JoinableDayRow } from '../ui/DayPicker';
import { useRefreshControl } from '../ui/useRefresh';
import { showToast } from '../ui/toast';
import { useAppState, DayStatus, Group } from '../state/AppState';

const wrap = { padding: SPACE.lg, paddingTop: 56, paddingBottom: 40 } as const;
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mkWeek = (states: DayStatus['state'][]): DayStatus[] => LABELS.map((day, i) => ({ day, state: states[i] }));

/* ---------------- Onboarding ---------------- */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { gyms, setGym } = useAppState();
  const [selId, setSelId] = useState<string | null>(null);
  const selName = gyms.find((g) => g.id === selId)?.name;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={wrap}>
        <H1 style={{ fontSize: 34, marginBottom: 8 }}>Welcome to GymJam</H1>
        <Sub style={{ marginBottom: 24 }}>Pick your home gym — you'll choose a group once you're in.</Sub>
        <Text style={styles.h2}>Nearby Gyms</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          {gyms.map((g) => {
            const on = selId === g.id;
            return (
              <Card key={g.id} onPress={() => setSelId(g.id)} style={on ? { borderColor: C.primary, borderWidth: 2 } : undefined}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                    <View style={styles.iconCircle}><MaterialIcons name="place" size={20} color={C.primary} /></View>
                    <View>
                      <Text style={styles.cardTitle}>{g.name}</Text>
                    </View>
                  </View>
                  {on && <MaterialIcons name="check-circle" size={22} color={C.primary} />}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Btn label={selName ? `Continue with ${selName}` : 'Pick a gym to continue'} disabled={!selId}
          onPress={async () => { if (selId) { await setGym(selId); onDone(); } }} />
      </View>
    </View>
  );
}

/* ---------------- Home ---------------- */
export function Home({ onCheckIn, onPlan, onPot }: { onCheckIn: () => void; onPlan: () => void; onPot: () => void }) {
  const { thisWeek, elo, streak, pot, checkInToday, todayIndex, displayName } = useAppState();
  const refresh = useRefreshControl();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned').length;
  const pct = pledged ? (done / pledged) * 100 : 0;
  const canCheck = todayIndex !== -1;
  const firstName = displayName.split(' ')[0];
  return (
    <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <View style={[styles.rowBetween, { marginBottom: 6 }]}>
        <View style={{ flex: 1 }}>
          <Sub style={{ marginBottom: 4 }}>Hi {firstName}</Sub>
          <H1>This week</H1>
        </View>
        {streak > 0 && (
          <View style={styles.streakPill}>
            <MaterialIcons name="local-fire-department" size={16} color={C.accent} />
            <Text style={styles.streakTxt}>{streak} wk</Text>
          </View>
        )}
      </View>
      <Sub style={{ marginBottom: 18 }}>Stay consistent. Your group is counting on you.</Sub>

      <Card style={{ marginBottom: 16 }}>
        <Text style={styles.label}>Your pledge</Text>
        <View style={{ marginTop: 10, marginBottom: 12 }}><DayPicker days={thisWeek} /></View>
        <View style={[styles.rowBetween, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Ring progress={pct} size={80} label={`${done}`} sublabel={`of ${pledged}`} />
            <View>
              <Sub>Sessions</Sub>
              <Text style={styles.big}>{done}/{pledged}</Text>
              <Sub>{pledged - done > 0 ? `${pledged - done} more to go!` : 'All done!'}</Sub>
            </View>
          </View>
        </View>
      </Card>

      <Card onPress={onPot} style={{ marginBottom: 16 }}>
        <LivePot amount={pot} />
        <Sub style={{ marginTop: 8 }}>Tap to see the live breakdown</Sub>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <Card style={{ flex: 1 }}>
          <View style={styles.rowGap}><MaterialIcons name="emoji-events" size={20} color={C.primary} /><Sub>ELO</Sub></View>
          <Text style={styles.big}>{elo.toLocaleString()}</Text>
          <Chip text={tierForElo(elo)} tone="primary" />
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={styles.rowGap}><MaterialIcons name="local-fire-department" size={20} color={C.accent} /><Sub>Streak</Sub></View>
          <Text style={styles.big}>{streak} weeks</Text>
          <Sub>Personal best!</Sub>
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <Btn label={canCheck ? 'Check In' : 'All sessions checked in'} icon="place" disabled={!canCheck}
          onPress={() => { checkInToday(); onCheckIn(); }} />
        <Btn label="Plan next week" variant="secondary" icon="event" onPress={onPlan} />
        <Sub style={{ textAlign: 'center' }}>Make sure you're at your gym to check in</Sub>
      </View>
    </ScrollView>
  );
}

function LivePot({ amount }: { amount: number }) {
  return (
    <View>
      <Sub style={{ fontWeight: '600' }}>Group Pot</Sub>
      <Text style={{ fontSize: 40, fontWeight: '700', color: C.accent, marginTop: 4 }}>{amount.toLocaleString()} ELO</Text>
      <View style={{ height: 8, backgroundColor: C.muted, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ height: 8, width: '70%', backgroundColor: C.primary, borderRadius: 4 }} />
      </View>
    </View>
  );
}

/* ---------------- Check-in success ---------------- */
export function CheckIn({ onClose }: { onClose: () => void }) {
  const { thisWeek, gymName } = useAppState();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned').length;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[wrap, { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }]}>
      <Ring progress={100} size={150} />
      <MaterialIcons name="check-circle" size={64} color={C.primary} style={{ marginTop: -110, marginBottom: 70 }} />
      <H1 style={{ textAlign: 'center' }}>Session counted!</H1>
      <Sub style={{ textAlign: 'center', marginBottom: 24 }}>You're on track. Keep it going!</Sub>
      <Card style={{ width: '100%', marginBottom: 24 }}>
        <View style={[styles.rowBetween, { marginBottom: 16 }]}>
          <Sub>Today's progress</Sub>
          <View style={styles.rowGap}><MaterialIcons name="place" size={16} color={C.primary} /><Sub>{gymName}</Sub></View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat n={`${done}`} l="Done" color={C.primary} />
          <Stat n={`${pledged}`} l="Pledged" />
          <Stat n="+10" l="ELO" color={C.accent} />
        </View>
      </Card>
      <Btn label="Back to Home" onPress={onClose} style={{ width: '100%' }} />
    </ScrollView>
  );
}
function Stat({ n, l, color = C.ink }: { n: string; l: string; color?: string }) {
  return <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '700', color }}>{n}</Text><Sub>{l}</Sub></View>;
}

/* ---------------- Plan next week ---------------- */
export function PlanWeek({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { nextWeek, setPlannedDays, lockNextWeek, groupName, potNext, updatePotConditions } = useAppState();

  // Local selection seeded from the persisted plan. Mutating this is free
  // (no network); we only commit when the user taps "Lock in my week".
  const [local, setLocal] = useState<DayStatus['state'][]>(() => nextWeek.map((d) => d.state));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!saving) setLocal(nextWeek.map((d) => d.state));
  }, [nextWeek, saving]);

  // The backend defaults missing/old conditions to 0 in our normalizer; treat
  // anything <=0 as "no cap configured" so the screen stays usable.
  const required = potNext && potNext.required_pledges > 0 ? potNext.required_pledges : 7;
  const stakePerMiss = potNext?.stake_per_miss ?? 0;
  const sel = local.filter((s) => s === 'planned').length;
  const atCap = sel >= required;
  const overCap = sel > required;
  const overBy = Math.max(0, sel - required);
  const editableDays: DayStatus[] = local.map((state, i) => ({ day: LABELS[i], state }));

  const toggleLocal = (i: number) => {
    setLocal((arr) => arr.map((s, idx) => {
      if (idx !== i) return s;
      if (s === 'locked' || s === 'checked-in' || s === 'missed') return s;
      if (s === 'unselected' && atCap) return s; // hard cap
      return s === 'planned' ? 'unselected' : 'planned';
    }));
  };

  const commitAndLock = async () => {
    if (overCap) {
      showToast(`Remove ${overBy} ${overBy === 1 ? 'day' : 'days'} — pot only allows ${required}`, 'info');
      return;
    }
    setSaving(true);
    try {
      const days = local
        .map((s, i) => (s === 'planned' ? i : -1))
        .filter((i): i is number => i !== -1);
      await setPlannedDays(days);
      await lockNextWeek();
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[wrap, { paddingBottom: 140 }]}>
        <View style={[styles.rowBetween, { marginBottom: 8 }]}>
          <H1>Plan next week</H1>
          <Pressable onPress={onCancel}><MaterialIcons name="close" size={22} color={C.mutedFg} /></Pressable>
        </View>
        <Sub style={{ marginBottom: 16 }}>Pick up to {required} {required === 1 ? 'day' : 'days'} — the cap is this week's pot rule.</Sub>

        <PotConditionsEditor potNext={potNext} onSave={updatePotConditions} />

        <Card style={{ marginBottom: 16 }}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <Text style={styles.label}>Choose your days</Text>
            <Text style={{ color: overCap ? C.accent : C.primary, fontWeight: '600' }}>{sel} / {required}</Text>
          </View>
          <DayPicker days={editableDays} editable onToggle={toggleLocal} />
          {overCap && (
            <Sub style={{ marginTop: 12, color: C.accent }}>
              You've pledged {overBy} more than this week's cap. Remove {overBy} to lock in.
            </Sub>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 16 }}>
            <Sub>Your stake</Sub>
            <Text style={styles.big}>{(required * stakePerMiss).toLocaleString()} ELO</Text>
            <Sub>{stakePerMiss.toLocaleString()} ELO lost per missed session</Sub>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MaterialIcons name="event" size={20} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Group challenge</Text>
              <Sub>{groupName || 'Your group'} pledges {required} sessions each. The pot is split among everyone who hits the target.</Sub>
            </View>
          </View>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Btn
          label={saving ? 'Saving…' : overCap ? `Remove ${overBy} to lock in` : 'Lock in my week'}
          disabled={sel === 0 || saving || overCap}
          onPress={commitAndLock}
        />
      </View>
    </View>
  );
}

/* ---- Pot conditions editor (visible only to the next-week setter) ---- */
function PotConditionsEditor({
  potNext,
  onSave,
}: {
  potNext: import('../../lib/api/pot').PotDetail | null;
  onSave: (week: 'current' | 'next', required: number, stake: number) => Promise<void>;
}) {
  const { userId } = useAppState();
  if (!potNext) return null;
  const isSetter = userId != null && userId === potNext.setter_user_id && !potNext.is_finalized;

  const [required, setRequired] = useState(String(potNext.required_pledges));
  const [stake, setStake] = useState(String(potNext.stake_per_miss));
  useEffect(() => {
    setRequired(String(potNext.required_pledges));
    setStake(String(potNext.stake_per_miss));
  }, [potNext.required_pledges, potNext.stake_per_miss]);

  if (!isSetter) {
    return (
      <Card style={{ marginBottom: 16, backgroundColor: 'rgba(138,177,125,0.07)', borderColor: 'rgba(138,177,125,0.22)' }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MaterialIcons name="gavel" size={20} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>This week's pot rules</Text>
            <Sub>
              Set by {potNext.setter_display_name ?? 'the group'} — {potNext.required_pledges} {potNext.required_pledges === 1 ? 'pledge' : 'pledges'}, {potNext.stake_per_miss} ELO per miss.
              {potNext.is_finalized ? ' Frozen.' : ''}
            </Sub>
          </View>
        </View>
      </Card>
    );
  }

  const save = () => {
    const r = Math.max(1, Math.min(7, parseInt(required, 10) || 0));
    const s = Math.max(0, parseInt(stake, 10) || 0);
    onSave('next', r, s);
  };

  return (
    <Card style={{ marginBottom: 16, backgroundColor: 'rgba(138,177,125,0.07)', borderColor: 'rgba(138,177,125,0.22)' }}>
      <View style={[styles.rowBetween, { marginBottom: 12 }]}>
        <Text style={styles.cardTitle}>Set this week's pot rules</Text>
        <Chip text="Setter" tone="primary" />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Required pledges</Text>
          <TextInput value={required} onChangeText={(t) => setRequired(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Stake per miss</Text>
          <TextInput value={stake} onChangeText={(t) => setStake(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} />
        </View>
      </View>
      <Btn label="Save rules" onPress={save} style={{ marginTop: 12 }} />
    </Card>
  );
}


/* ---------------- Group (with per-day join) ---------------- */
export function GroupView({ onBrowse }: { onBrowse: () => void }) {
  const { groupName, nextWeek, addNextWeekDay, groupMembers, refreshGroupsAtGym, potNext } = useAppState();
  const refresh = useRefreshControl();
  const [tab, setTab] = useState<'this' | 'next'>('this');
  const [joined, setJoined] = useState<string[]>([]);
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);

  const cap = potNext?.required_pledges ?? 7;
  const myPledgedCount = nextWeek.filter((d) => d.state === 'planned' || d.state === 'locked').length;

  const joinDay = (member: string, i: number) => {
    const key = `${member}-${i}`;
    if (joined.includes(key)) return;
    if (myPledgedCount >= cap) {
      showToast(`Pot allows only ${cap} pledges this week`, 'info');
      return;
    }
    setJoined((j) => [...j, key]); addNextWeekDay(i);
  };
  return (
    <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <View><H1>{groupName}</H1>
          <View style={[styles.rowGap, { marginTop: 4 }]}><MaterialIcons name="group" size={16} color={C.mutedFg} /><Sub>{groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}</Sub></View>
        </View>
        <Btn label="Browse" variant="tertiary" onPress={onBrowse} style={{ height: 40, paddingHorizontal: 12 }} />
      </View>

      <View style={styles.tabBar}>
        {(['this', 'next'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={{ fontWeight: '600', color: tab === t ? C.ink : C.mutedFg }}>{t === 'this' ? 'This Week' : 'Next Week'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'next' && <Sub style={{ marginBottom: 12 }}>Tap any of a member's planned days to join just that day. Mix and match across people.</Sub>}

      {groupMembers.length === 0 ? (
        <Card><Sub style={{ textAlign: 'center' }}>No members yet.</Sub></Card>
      ) : (
        <View style={{ gap: 12 }}>
          {groupMembers.map((m) => (
            <Card key={m.userId}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                <View style={styles.avatar}><Text style={styles.avatarTxt}>{m.initials}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowGap}>
                    <Text style={styles.cardTitle}>{m.name}</Text>
                    {m.isLeader && <Chip text="Leader" tone="accent" />}
                  </View>
                  <Sub>{tab === 'this'
                    ? `${m.thisWeek.filter((d) => d.state === 'checked-in').length} of ${m.thisWeek.filter((d) => d.state !== 'unselected').length} done`
                    : `${m.nextWeek.filter((d) => d.state === 'planned' || d.state === 'locked').length} sessions planned`}</Sub>
                </View>
              </View>
              {tab === 'this'
                ? <DayPicker days={m.thisWeek} />
                : <JoinableDayRow days={m.nextWeek} joinedKeys={joined} memberName={m.userId} onJoin={(i) => joinDay(m.userId, i)} />}
            </Card>
          ))}
        </View>
      )}

      {tab === 'next' && (
        <Card style={{ marginTop: 16, backgroundColor: 'rgba(208,135,112,0.07)', borderColor: 'rgba(208,135,112,0.22)' }}>
          <Text style={styles.cardTitle}>Your next-week pledge so far</Text>
          <Sub style={{ marginBottom: 12 }}>{nextWeek.filter((d) => d.state === 'planned' || d.state === 'locked').length} sessions planned</Sub>
          <DayPicker days={nextWeek} />
        </Card>
      )}
    </ScrollView>
  );
}

/* ---------------- Empty group state ---------------- */
export function NoGroup({ onBrowse }: { onBrowse: () => void }) {
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={[wrap, { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }]}>
      <View style={styles.bigCircle}><MaterialIcons name="group" size={48} color={C.primary} /></View>
      <H1 style={{ textAlign: 'center', marginTop: 16 }}>Join a group</H1>
      <Sub style={{ textAlign: 'center', marginVertical: 12 }}>You're in your gym but not in a group yet. Browse the groups at your gym and join one to start the weekly challenge.</Sub>
      <Btn label="Browse groups" onPress={onBrowse} style={{ width: '100%' }} />
    </ScrollView>
  );
}

/* ---------------- Gym browser (open/private + leader inbox + create) ---------------- */
export function GymBrowser({ onBack, onJoined }: { onBack: () => void; onJoined: () => void }) {
  const { gymName, groupId, groups, addGroup, joinGroup, leaveGroup, joinRequests, approveRequest, rejectRequest, refreshGroupsAtGym } = useAppState();
  const refresh = useRefreshControl();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''); const [stake, setStake] = useState('500');
  const [jt, setJt] = useState<'open' | 'request'>('open');
  const [inbox, setInbox] = useState(false);
  const inGroup = groupId !== null;
  // Refresh whenever the browser is opened so new groups, member counts,
  // and join requests show up live.
  useEffect(() => { refreshGroupsAtGym(); }, [refreshGroupsAtGym]);

  // The current group we're a member of (only one allowed), used to
  // decide whether "Leave" should warn about deleting the group.
  const myGroup = groups.find((g) => g.isMember);
  const aloneAndLeader = !!myGroup && myGroup.isLeader === true && myGroup.members <= 1;

  const join = async (g: Group) => {
    if (inGroup) return;
    await joinGroup(g.id);
    if (g.joinType === 'open') onJoined();
  };
  const create = async () => {
    if (!name.trim()) return;
    await addGroup({
      name: name.trim(),
      weekly_stake_elo: parseInt(stake, 10) || 500,
      join_type: jt,
    });
    setCreating(false); setName('');
    onJoined();
  };
  const onLeavePress = (g: Group) => {
    const sole = g.isLeader === true && g.members <= 1;
    if (sole) {
      Alert.alert(
        'Delete group?',
        'You are the only member, so leaving will delete the group. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => leaveGroup() },
        ],
      );
    } else {
      leaveGroup();
    }
  };
  void aloneAndLeader; // available for future header hint

  return (
    <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <Pressable onPress={onBack} style={styles.rowGap}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
        {joinRequests.length > 0 && (
          <Pressable onPress={() => setInbox((s) => !s)} style={styles.rowGap}>
            <MaterialIcons name="notifications" size={18} color={C.primary} />
            <Text style={{ color: C.primary }}>Requests ({joinRequests.length})</Text>
          </Pressable>
        )}
      </View>

      <H1 style={{ marginBottom: 4 }}>Browse Groups</H1>
      <View style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="place" size={16} color={C.mutedFg} /><Sub>{gymName}</Sub></View>

      {inbox && joinRequests.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: C.primary, borderWidth: 2 }}>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Join requests</Text>
          <View style={{ gap: 8 }}>
            {joinRequests.map((req) => (
              <View key={req.id} style={styles.rowBetween}>
                <View style={styles.rowGap}>
                  <View style={[styles.avatar, { width: 32, height: 32 }]}><Text style={styles.avatarTxt}>{req.userName.slice(0, 2).toUpperCase()}</Text></View>
                  <Text>{req.userName} → {req.groupName}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable onPress={() => { approveRequest(req.id); if (joinRequests.length === 1) setInbox(false); }} style={[styles.actBtn, { backgroundColor: C.primary }]}><MaterialIcons name="check" size={16} color={C.primaryFg} /></Pressable>
                  <Pressable onPress={() => { rejectRequest(req.id); if (joinRequests.length === 1) setInbox(false); }} style={[styles.actBtn, { backgroundColor: C.muted }]}><MaterialIcons name="close" size={16} color={C.mutedFg} /></Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card style={{ marginBottom: 16, backgroundColor: 'rgba(138,177,125,0.07)', borderColor: 'rgba(138,177,125,0.22)' }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MaterialIcons name="group" size={20} color={C.primary} />
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>One group per gym</Text><Sub>Leave your current group to join a different one.</Sub></View>
        </View>
      </Card>

      <View style={[styles.rowBetween, { marginBottom: 12 }]}>
        <Text style={styles.h2}>Groups at this gym</Text>
        <Btn label="Create" variant="tertiary" icon="add" onPress={() => setCreating((c) => !c)} style={{ height: 40, paddingHorizontal: 12 }} />
      </View>

      {creating && (
        <Card style={{ marginBottom: 16 }}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Create a new group</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Group name (e.g. 6am Club)" placeholderTextColor={C.mutedFg} style={styles.input} />
          <Text style={[styles.label, { marginTop: 10 }]}>Weekly stake (ELO)</Text>
          <TextInput value={stake} onChangeText={(t) => setStake(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} />
          <Text style={[styles.label, { marginTop: 10, marginBottom: 6 }]}>Who can join?</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['open', 'request'] as const).map((opt) => (
              <Pressable key={opt} onPress={() => setJt(opt)} style={[styles.jtOpt, jt === opt && { borderColor: C.primary, backgroundColor: 'rgba(138,177,125,0.07)' }]}>
                <View style={styles.rowGap}><MaterialIcons name={opt === 'open' ? 'person-add' : 'lock'} size={16} color={C.ink} /><Text style={{ fontWeight: '600' }}>{opt === 'open' ? 'Open' : 'Private'}</Text></View>
                <Sub>{opt === 'open' ? 'Anyone joins instantly' : 'You approve each request'}</Sub>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Create & join" disabled={!name.trim()} onPress={create} style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={() => setCreating(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      <View style={{ gap: 12 }}>
        {groups.map((g) => {
          const isJoined = g.isMember === true;
          const canAct = !inGroup;
          const pending = g.requested === true;
          return (
            <Card key={g.id} style={isJoined ? { borderColor: C.primary, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={styles.avatar}><MaterialIcons name="group" size={22} color={C.primaryFg} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    {isJoined && <Chip text="Joined" tone="primary" />}
                    {g.isLeader && <Chip text="Leader" tone="accent" />}
                    <Chip text={g.joinType === 'open' ? 'Open' : 'Private'} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Chip text={`${g.members} members`} /><Chip text={g.tier} tone="primary" />
                    <Sub>{g.stake}</Sub>
                  </View>
                </View>
              </View>
              {isJoined ? (
                <Btn
                  label={g.isLeader && g.members <= 1 ? 'Delete Group' : 'Leave Group'}
                  variant="secondary"
                  onPress={() => onLeavePress(g)}
                />
              ) : pending ? <Btn label="Request pending" variant="secondary" disabled />
                  : <Btn label={!canAct ? 'Already in a group' : g.joinType === 'open' ? 'Join Group' : 'Request to join'} variant={canAct ? 'primary' : 'secondary'} disabled={!canAct} onPress={() => join(g)} />}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ---------------- Pot tracker ---------------- */
export function PotTracker({ onBack }: { onBack: () => void }) {
  const { potCurrent } = useAppState();
  const refresh = useRefreshControl();

  if (!potCurrent) {
    return (
      <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
        <Pressable onPress={onBack} style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
        <H1 style={{ marginBottom: 16 }}>Weekly Pot</H1>
        <Card><Sub style={{ textAlign: 'center' }}>Join a group to see the pot.</Sub></Card>
      </ScrollView>
    );
  }

  const totalAtStake = potCurrent.members.reduce((s, m) => s + m.elo_at_risk, 0);
  const onTrack = potCurrent.members.filter((m) => m.is_on_track).length;

  return (
    <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <Pressable onPress={onBack} style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
      <H1 style={{ marginBottom: 4 }}>Weekly Pot</H1>
      <Sub style={{ marginBottom: 16 }}>Track the pot as it grows through the week</Sub>

      <Card style={{ marginBottom: 16 }}>
        <Sub style={{ fontWeight: '600' }}>Current pot</Sub>
        <Text style={{ fontSize: 42, fontWeight: '700', color: C.accent, marginTop: 4 }}>
          {potCurrent.total_pot_elo.toLocaleString()} ELO
        </Text>
        <Sub style={{ marginTop: 4 }}>
          {onTrack} of {potCurrent.members.length} {potCurrent.members.length === 1 ? 'member' : 'members'} on track · {totalAtStake.toLocaleString()} ELO at stake
        </Sub>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>This week's conditions</Text>
          {potCurrent.is_finalized && <Chip text="Frozen" tone="muted" />}
        </View>
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={styles.rowBetween}>
            <Sub>Required pledges</Sub>
            <Text style={styles.big}>{potCurrent.required_pledges}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Sub>Stake per miss</Sub>
            <Text style={styles.big}>{potCurrent.stake_per_miss} ELO</Text>
          </View>
          <View style={styles.rowBetween}>
            <Sub>Total at risk per person</Sub>
            <Text style={styles.big}>{(potCurrent.required_pledges * potCurrent.stake_per_miss).toLocaleString()} ELO</Text>
          </View>
        </View>
        {potCurrent.setter_display_name && (
          <Sub style={{ marginTop: 12 }}>
            Set by {potCurrent.setter_display_name}{potCurrent.members.find((m) => m.is_setter)?.role === 'leader' ? ' · Leader' : ''}
          </Sub>
        )}
      </Card>

      <Text style={[styles.h2, { marginBottom: 12 }]}>Member breakdown</Text>
      {potCurrent.members.length === 0 ? (
        <Card><Sub style={{ textAlign: 'center' }}>No members in the group yet.</Sub></Card>
      ) : (
        <View style={{ gap: 12 }}>
          {potCurrent.members.map((m) => {
            const chipText = m.is_on_track
              ? 'On track'
              : `${m.elo_lost_so_far.toLocaleString()} at risk`;
            const tone: 'primary' | 'accent' | 'muted' = m.is_on_track ? 'primary' : 'accent';
            return (
              <Card key={m.user_id}>
                <View style={styles.rowBetween}>
                  <View style={[styles.rowGap, { flexShrink: 1 }]}>
                    <Text style={styles.cardTitle}>{m.display_name}</Text>
                    {m.is_setter && <Chip text="Setter" tone="primary" />}
                  </View>
                  <Chip text={chipText} tone={tone} />
                </View>
                <Sub style={{ marginTop: 4 }}>
                  {m.completed_count} of {potCurrent.required_pledges} sessions done · {m.missed_count > 0 ? `${m.missed_count} missed` : 'no misses'}
                </Sub>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ---------------- Progress ---------------- */
type BadgeKey = keyof import('../../lib/api/badges').Badges;
const BADGE_CATALOG: { key: BadgeKey; name: string; icon: string }[] = [
  { key: 'first_week', name: 'First Week', icon: '🎯' },
  { key: 'streak_master', name: 'Streak Master', icon: '🔥' },
  { key: 'early_bird', name: 'Early Bird', icon: '🌅' },
  { key: 'consistency_king', name: 'Consistency King', icon: '👑' },
  { key: 'pot_winner', name: 'Pot Winner', icon: '💰' },
  { key: 'group_leader', name: 'Group Leader', icon: '⭐' },
];

export function Progress({ onGymSpace }: { onGymSpace: () => void }) {
  const { elo, badges: badgeFlags } = useAppState();
  const refresh = useRefreshControl();
  const tiers = [
    { name: 'Beginner', min: 0, max: 500 }, { name: 'Rookie', min: 500, max: 1000 },
    { name: 'Regular', min: 1000, max: 2000 }, { name: 'Mogger', min: 2000, max: Infinity },
  ];
  const ti = tiers.findIndex((t) => elo >= t.min && elo < t.max);
  const cur = tiers[ti]; const next = tiers[ti + 1];
  const pct = next ? ((elo - cur.min) / (next.min - cur.min)) * 100 : 100;
  const badges = BADGE_CATALOG.map((b) => ({ ...b, on: badgeFlags[b.key] }));
  return (
    <ScrollView refreshControl={refresh} style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <H1 style={{ marginBottom: 4 }}>Progress</H1>
      <Sub style={{ marginBottom: 16 }}>Track your growth and unlock rewards</Sub>
      <Card style={{ marginBottom: 16 }}>
        <Sub>Your ELO Rating</Sub>
        <Text style={{ fontSize: 36, fontWeight: '700', color: C.ink }}>{elo.toLocaleString()}</Text>
        <Chip text={cur.name} tone="primary" />
        {next && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.rowBetween}><Sub>Progress to {next.name}</Sub><Text style={{ color: C.primary, fontWeight: '600' }}>{elo}/{next.min}</Text></View>
            <View style={{ height: 8, backgroundColor: C.muted, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}><View style={{ height: 8, width: `${pct}%`, backgroundColor: C.primary }} /></View>
          </View>
        )}
      </Card>
      <Text style={[styles.h2, { marginBottom: 12 }]}>Arena Ladder</Text>
      <Card style={{ marginBottom: 16, padding: 0 }}>
        {tiers.map((t, i) => {
          const reached = elo >= t.min;
          const current = i === ti;
          const icon = ['fitness-center', 'directions-run', 'sports-martial-arts', 'military-tech'][i];
          return (
            <View key={t.name} style={[styles.ladderRow, i < tiers.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }, current && { backgroundColor: 'rgba(138,177,125,0.10)' }]}>
              <View style={[styles.ladderIcon, { backgroundColor: reached ? C.primary : C.muted }]}>
                <MaterialIcons name={icon as any} size={20} color={reached ? C.primaryFg : C.mutedFg} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowGap}>
                  <Text style={[styles.cardTitle, !reached && { color: C.mutedFg }]}>{t.name}</Text>
                  {current && <Chip text="You are here" tone="primary" />}
                </View>
                <Sub>{t.max === Infinity ? `${t.min}+ ELO` : `${t.min}\u2013${t.max} ELO`}</Sub>
              </View>
              {reached
                ? <MaterialIcons name="check-circle" size={20} color={C.primary} />
                : <MaterialIcons name="lock" size={18} color={C.mutedFg} />}
            </View>
          );
        })}
      </Card>
      <Text style={[styles.h2, { marginBottom: 12 }]}>Badges</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {badges.map((b) => (
          <Card key={b.name} style={{ width: '30%', alignItems: 'center', opacity: b.on ? 1 : 0.4 }}>
            <Text style={{ fontSize: 28 }}>{b.icon}</Text><Sub style={{ textAlign: 'center' }}>{b.name}</Sub>
          </Card>
        ))}
      </View>
      <Card onPress={onGymSpace} style={{ backgroundColor: 'rgba(138,177,125,0.10)', borderColor: 'rgba(138,177,125,0.22)' }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MaterialIcons name="grid-view" size={20} color={C.primary} />
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Your Gym Space</Text><Sub>Tap to decorate your space with rewards you've unlocked</Sub></View>
          <MaterialIcons name="chevron-right" size={22} color={C.mutedFg} />
        </View>
      </Card>
    </ScrollView>
  );
}

/* ---------------- Gym Space ---------------- */
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
  const freeSlot = () => {
    for (let s = 0; s < 9; s++) if (!placedSlots.has(s)) return s;
    return null;
  };
  const toggle = (it: SpaceItemDef) => {
    if (!unlocked(it)) return;
    const currentSlot = placementByItem.get(it.id);
    if (currentSlot !== undefined) {
      placeRoomItem(it.id, null);
      return;
    }
    const f = freeSlot();
    if (f === null) return;
    placeRoomItem(it.id, f);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <Pressable onPress={onBack} style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
      <H1 style={{ marginBottom: 4 }}>Your Gym Space</H1>
      <Sub style={{ marginBottom: 16 }}>Earn rewards by leveling up, then decorate your space</Sub>
      <Text style={[styles.h2, { marginBottom: 8 }]}>My Room</Text>
      <Card style={{ marginBottom: 16, padding: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 6 }}>
          {Array.from({ length: 9 }).map((_, slot) => {
            const placement = roomItems.find((r) => r.slot === slot);
            const def = placement && ROOM_ITEMS.find((i) => i.id === placement.item_id);
            return (
              <View key={slot} style={{ width: '33.33%', aspectRatio: 1, padding: 4 }}>
                <View style={{ flex: 1, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: def ? C.card : 'transparent', borderWidth: def ? 0 : 2, borderColor: C.border, borderStyle: 'dashed' }}>
                  {def && <Text style={{ fontSize: 32 }}>{def.emoji}</Text>}
                </View>
              </View>
            );
          })}
        </View>
        <Sub style={{ textAlign: 'center', marginTop: 8 }}>Tap an item to place it · tap a placed item to remove</Sub>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {ROOM_ITEMS.map((it) => {
          const on = unlocked(it);
          const isPlaced = placementByItem.has(it.id);
          return (
            <Pressable key={it.id} disabled={!on} onPress={() => toggle(it)}
              style={[styles.itemCard, { opacity: on ? 1 : 0.5 }]}>
              <Text style={{ fontSize: 28 }}>{it.emoji}</Text>
              <Sub style={{ textAlign: 'center' }}>{it.name}</Sub>
              {!on && <View style={styles.lockBadge}><MaterialIcons name="lock" size={10} color={C.mutedFg} /><Text style={{ fontSize: 9, color: C.mutedFg }}>{it.unlockElo}</Text></View>}
              {on && isPlaced && <View style={styles.checkBadge}><MaterialIcons name="check" size={12} color={C.primaryFg} /></View>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2: { fontSize: 18, fontWeight: '600', color: C.ink },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  label: { fontSize: 13, fontWeight: '600', color: C.mutedFg },
  big: { fontSize: 22, fontWeight: '700', color: C.ink },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(138,177,125,0.16)', alignItems: 'center', justifyContent: 'center' },
  bigCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(138,177,125,0.16)', alignItems: 'center', justifyContent: 'center' },
  footer: { padding: SPACE.lg, paddingBottom: 32, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(208,135,112,0.13)', borderRadius: RADIUS.pill },
  streakTxt: { fontWeight: '700', color: C.accent },
  tabBar: { flexDirection: 'row', gap: 8, backgroundColor: C.muted, borderRadius: RADIUS.md, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabOn: { backgroundColor: C.bg },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg },
  ladderIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.primaryFg, fontWeight: '700', fontSize: 13 },
  input: { height: 44, paddingHorizontal: 12, borderRadius: RADIUS.md, backgroundColor: C.muted, borderWidth: 1, borderColor: C.border, color: C.ink, marginTop: 4 },
  jtOpt: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border },
  actBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemCard: { width: '30%', aspectRatio: 1, backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  lockBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.muted, borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2 },
  checkBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: C.primary, borderRadius: 10, padding: 2 },
});