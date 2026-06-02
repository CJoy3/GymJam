import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Card, Btn, Chip, H1, Sub, Ring } from '../ui/components';
import { DayPicker, JoinableDayRow } from '../ui/DayPicker';
import { useAppState, DayStatus, Group } from '../state/AppState';

const wrap = { padding: SPACE.lg, paddingTop: 56, paddingBottom: 40 } as const;
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const mkWeek = (states: DayStatus['state'][]): DayStatus[] => LABELS.map((day, i) => ({ day, state: states[i] }));

/* ---------------- Onboarding ---------------- */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { setGym } = useAppState();
  const [sel, setSel] = useState<string | null>(null);
  const gyms = [
    { name: 'PureGym Manchester', distance: '0.3 miles', groups: 12 },
    { name: 'The Gym Group', distance: '0.5 miles', groups: 8 },
    { name: 'Fitness First', distance: '0.8 miles', groups: 5 },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={wrap}>
        <H1 style={{ fontSize: 34, marginBottom: 8 }}>Welcome to GymJam</H1>
        <Sub style={{ marginBottom: 24 }}>Pick your home gym — you'll choose a group once you're in.</Sub>
        <Text style={styles.h2}>Nearby Gyms</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          {gyms.map((g) => {
            const on = sel === g.name;
            return (
              <Card key={g.name} onPress={() => setSel(g.name)} style={on ? { borderColor: C.primary, borderWidth: 2 } : undefined}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                    <View style={styles.iconCircle}><MaterialIcons name="place" size={20} color={C.primary} /></View>
                    <View>
                      <Text style={styles.cardTitle}>{g.name}</Text>
                      <Sub>{g.distance} · {g.groups} groups</Sub>
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
        <Btn label={sel ? `Continue with ${sel}` : 'Pick a gym to continue'} disabled={!sel}
          onPress={() => { if (sel) { setGym(sel); onDone(); } }} />
      </View>
    </View>
  );
}

/* ---------------- Home ---------------- */
export function Home({ onCheckIn, onPlan, onPot }: { onCheckIn: () => void; onPlan: () => void; onPot: () => void }) {
  const { thisWeek, elo, streak, pot, checkInToday, todayIndex } = useAppState();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned').length;
  const pct = pledged ? (done / pledged) * 100 : 0;
  const canCheck = todayIndex !== -1;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <View style={[styles.rowBetween, { marginBottom: 8 }]}>
        <H1>This Week</H1>
        <View style={styles.streakPill}><MaterialIcons name="local-fire-department" size={16} color={C.accent} /><Text style={styles.streakTxt}>{streak}</Text></View>
      </View>
      <Sub style={{ marginBottom: 16 }}>Monday, June 1 – Sunday, June 7</Sub>

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
  const { nextWeek, toggleNextWeekDay, lockNextWeek, groupName } = useAppState();
  const sel = nextWeek.filter((d) => d.state === 'planned').length;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[wrap, { paddingBottom: 140 }]}>
        <View style={[styles.rowBetween, { marginBottom: 8 }]}>
          <H1>Plan Next Week</H1>
          <Pressable onPress={onCancel}><MaterialIcons name="close" size={22} color={C.mutedFg} /></Pressable>
        </View>
        <Sub style={{ marginBottom: 16 }}>Pick the days you'll hit the gym. Your group is counting on you!</Sub>
        <Card style={{ marginBottom: 16, backgroundColor: 'rgba(255,107,74,0.05)', borderColor: 'rgba(255,107,74,0.2)' }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MaterialIcons name="schedule" size={20} color={C.accent} />
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Locks Sunday 11:59pm</Text><Sub>Change your pledge until then. After that, it's locked in.</Sub></View>
          </View>
        </Card>
        <Card style={{ marginBottom: 16 }}>
          <View style={[styles.rowBetween, { marginBottom: 10 }]}>
            <Text style={styles.label}>Choose your days</Text>
            <Text style={{ color: C.primary, fontWeight: '600' }}>{sel} {sel === 1 ? 'day' : 'days'}</Text>
          </View>
          <DayPicker days={nextWeek} editable onToggle={toggleNextWeekDay} />
          {sel > 0 && (
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 16, paddingTop: 16 }}>
              <Sub>Your stake this week</Sub>
              <Text style={styles.big}>{sel * 100} ELO</Text>
            </View>
          )}
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MaterialIcons name="event" size={20} color={C.primary} />
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Group challenge</Text>
              <Sub>{groupName || 'Your group'}'s goal is {sel || 3} sessions this week. Everyone who hits their pledge splits the pot!</Sub></View>
          </View>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Btn label="Lock in my week" disabled={sel === 0} onPress={() => { lockNextWeek(); onDone(); }} />
      </View>
    </View>
  );
}

/* ---------------- Group (with per-day join) ---------------- */
export function GroupView({ onBrowse }: { onBrowse: () => void }) {
  const { groupName, nextWeek, addNextWeekDay } = useAppState();
  const [tab, setTab] = useState<'this' | 'next'>('this');
  const [joined, setJoined] = useState<string[]>([]);
  const members = [
    { name: 'Sarah Chen', avatar: 'SC', thisWeek: mkWeek(['checked-in', 'planned', 'checked-in', 'unselected', 'planned', 'unselected', 'unselected']), nextWeek: mkWeek(['planned', 'unselected', 'planned', 'planned', 'unselected', 'unselected', 'unselected']) },
    { name: 'Marcus Johnson', avatar: 'MJ', thisWeek: mkWeek(['checked-in', 'missed', 'unselected', 'unselected', 'planned', 'planned', 'unselected']), nextWeek: mkWeek(['planned', 'planned', 'unselected', 'planned', 'planned', 'unselected', 'unselected']) },
    { name: 'Priya Patel', avatar: 'PP', thisWeek: mkWeek(['checked-in', 'checked-in', 'checked-in', 'planned', 'unselected', 'unselected', 'unselected']), nextWeek: mkWeek(['planned', 'planned', 'planned', 'planned', 'planned', 'unselected', 'unselected']) },
  ];
  const joinDay = (member: string, i: number) => {
    const key = `${member}-${i}`;
    if (joined.includes(key)) return;
    setJoined((j) => [...j, key]); addNextWeekDay(i);
  };
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <View style={[styles.rowBetween, { marginBottom: 16 }]}>
        <View><H1>{groupName}</H1>
          <View style={[styles.rowGap, { marginTop: 4 }]}><MaterialIcons name="group" size={16} color={C.mutedFg} /><Sub>8 members</Sub><Chip text="Regular" tone="primary" /></View>
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

      <View style={{ gap: 12 }}>
        {members.map((m) => (
          <Card key={m.name}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' }}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{m.avatar}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.name}</Text>
                <Sub>{tab === 'this'
                  ? `${m.thisWeek.filter((d) => d.state === 'checked-in').length} of ${m.thisWeek.filter((d) => d.state !== 'unselected').length} done`
                  : `${m.nextWeek.filter((d) => d.state === 'planned').length} sessions planned`}</Sub>
              </View>
            </View>
            {tab === 'this'
              ? <DayPicker days={m.thisWeek} />
              : <JoinableDayRow days={m.nextWeek} joinedKeys={joined} memberName={m.name} onJoin={(i) => joinDay(m.name, i)} />}
          </Card>
        ))}
      </View>

      {tab === 'next' && (
        <Card style={{ marginTop: 16, backgroundColor: 'rgba(255,107,74,0.05)', borderColor: 'rgba(255,107,74,0.2)' }}>
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

/* ---------------- Gym browser (open/request + leader inbox + create) ---------------- */
export function GymBrowser({ onBack, onJoined }: { onBack: () => void; onJoined: () => void }) {
  const { gymName, groupName, groups, addGroup, joinGroup, leaveGroup, joinRequests, requestToJoin, approveRequest, rejectRequest } = useAppState();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''); const [stake, setStake] = useState('500');
  const [jt, setJt] = useState<'open' | 'request'>('open');
  const [requested, setRequested] = useState<string[]>([]);
  const [inbox, setInbox] = useState(false);
  const inGroup = groupName !== '';

  const join = (g: Group) => {
    if (inGroup) return;
    if (g.joinType === 'open') { joinGroup(g.name); onJoined(); }
    else { requestToJoin(g.name); setRequested((r) => [...r, g.name]); }
  };
  const create = () => {
    if (!name.trim()) return;
    addGroup({ name: name.trim(), members: 1, tier: 'Beginner', stake: `${stake} ELO`, joinType: jt, isLeader: true });
    joinGroup(name.trim()); setCreating(false); setName(''); onJoined();
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
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
                  <Pressable onPress={() => { approveRequest(req.id); if (joinRequests.length === 1) setInbox(false); if (req.userName === 'You') onJoined(); }} style={[styles.actBtn, { backgroundColor: C.primary }]}><MaterialIcons name="check" size={16} color={C.primaryFg} /></Pressable>
                  <Pressable onPress={() => { rejectRequest(req.id); if (joinRequests.length === 1) setInbox(false); }} style={[styles.actBtn, { backgroundColor: C.muted }]}><MaterialIcons name="close" size={16} color={C.mutedFg} /></Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card style={{ marginBottom: 16, backgroundColor: 'rgba(168,225,12,0.05)', borderColor: 'rgba(168,225,12,0.2)' }}>
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
              <Pressable key={opt} onPress={() => setJt(opt)} style={[styles.jtOpt, jt === opt && { borderColor: C.primary, backgroundColor: 'rgba(168,225,12,0.05)' }]}>
                <View style={styles.rowGap}><MaterialIcons name={opt === 'open' ? 'person-add' : 'lock'} size={16} color={C.ink} /><Text style={{ fontWeight: '600' }}>{opt === 'open' ? 'Open' : 'Request'}</Text></View>
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
          const isJoined = groupName === g.name;
          const canAct = !inGroup;
          const pending = requested.includes(g.name);
          return (
            <Card key={g.name} style={isJoined ? { borderColor: C.primary, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={styles.avatar}><MaterialIcons name="group" size={22} color={C.primaryFg} /></View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    {isJoined && <Chip text="Joined" tone="primary" />}
                    {g.isLeader && <Chip text="Leader" tone="accent" />}
                    <Chip text={g.joinType === 'open' ? 'Open' : 'Request'} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Chip text={`${g.members} members`} /><Chip text={g.tier} tone="primary" />
                    <Sub>{g.stake}</Sub>
                  </View>
                </View>
              </View>
              {isJoined ? <Btn label="Leave Group" variant="secondary" onPress={leaveGroup} />
                : pending ? <Btn label="Request pending" variant="secondary" disabled />
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
  const { pot } = useAppState();
  const breakdown = [
    { name: 'Sarah Chen', done: 3, pledged: 4, risk: 100 },
    { name: 'Marcus Johnson', done: 1, pledged: 4, risk: 300 },
    { name: 'Priya Patel', done: 4, pledged: 4, risk: 0 },
    { name: 'Jordan Davis', done: 2, pledged: 4, risk: 200 },
  ];
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <Pressable onPress={onBack} style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
      <H1 style={{ marginBottom: 4 }}>Weekly Pot</H1>
      <Sub style={{ marginBottom: 16 }}>Track the pot as it grows through the week</Sub>
      <Card style={{ marginBottom: 16 }}><LivePot amount={pot} /></Card>
      <Card style={{ marginBottom: 16, backgroundColor: 'rgba(168,225,12,0.05)', borderColor: 'rgba(168,225,12,0.2)' }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MaterialIcons name="info" size={20} color={C.primary} />
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>How it works</Text><Sub>You only lose stake for sessions you miss. At week's end the pot is shared among everyone who hit their pledge.</Sub></View>
        </View>
      </Card>
      <Text style={[styles.h2, { marginBottom: 12 }]}>Member Breakdown</Text>
      <View style={{ gap: 12 }}>
        {breakdown.map((m) => (
          <Card key={m.name}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{m.name}</Text>
              <Chip text={m.risk === 0 ? 'Complete' : `${m.risk} at risk`} tone={m.risk === 0 ? 'primary' : 'accent'} />
            </View>
            <Sub style={{ marginTop: 4 }}>{m.done} of {m.pledged} sessions done</Sub>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

/* ---------------- Progress ---------------- */
export function Progress({ onGymSpace }: { onGymSpace: () => void }) {
  const { elo } = useAppState();
  const tiers = [
    { name: 'Beginner', min: 0, max: 500 }, { name: 'Rookie', min: 500, max: 1000 },
    { name: 'Regular', min: 1000, max: 2000 }, { name: 'Mogger', min: 2000, max: Infinity },
  ];
  const ti = tiers.findIndex((t) => elo >= t.min && elo < t.max);
  const cur = tiers[ti]; const next = tiers[ti + 1];
  const pct = next ? ((elo - cur.min) / (next.min - cur.min)) * 100 : 100;
  const badges = [
    { name: 'First Week', icon: '🎯', on: true }, { name: 'Streak Master', icon: '🔥', on: true },
    { name: 'Early Bird', icon: '🌅', on: true }, { name: 'Consistency King', icon: '👑', on: false },
    { name: 'Pot Winner', icon: '💰', on: false }, { name: 'Group Leader', icon: '⭐', on: false },
  ];
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
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
      <Text style={[styles.h2, { marginBottom: 12 }]}>Badges</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {badges.map((b) => (
          <Card key={b.name} style={{ width: '30%', alignItems: 'center', opacity: b.on ? 1 : 0.4 }}>
            <Text style={{ fontSize: 28 }}>{b.icon}</Text><Sub style={{ textAlign: 'center' }}>{b.name}</Sub>
          </Card>
        ))}
      </View>
      <Card onPress={onGymSpace} style={{ backgroundColor: 'rgba(168,225,12,0.08)', borderColor: 'rgba(168,225,12,0.2)' }}>
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
interface SpaceItem { id: string; name: string; emoji: string; unlockElo: number; slot: number | null; }
export function GymSpace({ onBack }: { onBack: () => void }) {
  const { elo } = useAppState();
  const [items, setItems] = useState<SpaceItem[]>([
    { id: 'mat', name: 'Yoga Mat', emoji: '🧘', unlockElo: 0, slot: 0 },
    { id: 'db', name: 'Dumbbells', emoji: '🏋️', unlockElo: 0, slot: 4 },
    { id: 'plant', name: 'Plant', emoji: '🪴', unlockElo: 500, slot: 2 },
    { id: 'bench', name: 'Bench', emoji: '🛋️', unlockElo: 500, slot: null },
    { id: 'banner', name: 'Banner', emoji: '🏆', unlockElo: 1000, slot: 6 },
    { id: 'tread', name: 'Treadmill', emoji: '🏃', unlockElo: 1000, slot: null },
    { id: 'neon', name: 'Neon Sign', emoji: '💡', unlockElo: 1200, slot: null },
    { id: 'ring', name: 'Boxing Ring', emoji: '🥊', unlockElo: 2000, slot: null },
    { id: 'mascot', name: 'Mascot', emoji: '🐯', unlockElo: 2000, slot: null },
  ]);
  const unlocked = (it: SpaceItem) => elo >= it.unlockElo;
  const placed = items.filter((i) => i.slot !== null);
  const freeSlot = () => { const taken = new Set(placed.map((i) => i.slot)); for (let s = 0; s < 9; s++) if (!taken.has(s)) return s; return null; };
  const toggle = (it: SpaceItem) => {
    if (!unlocked(it)) return;
    if (it.slot !== null) { setItems((p) => p.map((x) => x.id === it.id ? { ...x, slot: null } : x)); return; }
    const f = freeSlot(); if (f === null) return;
    setItems((p) => p.map((x) => x.id === it.id ? { ...x, slot: f } : x));
  };
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <Pressable onPress={onBack} style={[styles.rowGap, { marginBottom: 16 }]}><MaterialIcons name="arrow-back" size={18} color={C.mutedFg} /><Sub>Back</Sub></Pressable>
      <H1 style={{ marginBottom: 4 }}>Your Gym Space</H1>
      <Sub style={{ marginBottom: 16 }}>Earn rewards by leveling up, then decorate your space</Sub>
      <Text style={[styles.h2, { marginBottom: 8 }]}>My Room</Text>
      <Card style={{ marginBottom: 16, padding: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', aspectRatio: 1, backgroundColor: 'rgba(232,229,223,0.5)', borderRadius: RADIUS.md, padding: 6 }}>
          {Array.from({ length: 9 }).map((_, slot) => {
            const it = placed.find((i) => i.slot === slot);
            return (
              <View key={slot} style={{ width: '33.33%', aspectRatio: 1, padding: 4 }}>
                <View style={{ flex: 1, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: it ? C.card : 'transparent', borderWidth: it ? 0 : 2, borderColor: C.border, borderStyle: 'dashed' }}>
                  {it && <Text style={{ fontSize: 32 }}>{it.emoji}</Text>}
                </View>
              </View>
            );
          })}
        </View>
        <Sub style={{ textAlign: 'center', marginTop: 8 }}>Tap an item to place it · tap a placed item to remove</Sub>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {items.map((it) => {
          const on = unlocked(it); const isPlaced = it.slot !== null;
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
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(168,225,12,0.15)', alignItems: 'center', justifyContent: 'center' },
  bigCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(168,225,12,0.15)', alignItems: 'center', justifyContent: 'center' },
  footer: { padding: SPACE.lg, paddingBottom: 32, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,107,74,0.1)', borderRadius: RADIUS.pill },
  streakTxt: { fontWeight: '700', color: C.accent },
  tabBar: { flexDirection: 'row', gap: 8, backgroundColor: C.muted, borderRadius: RADIUS.md, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabOn: { backgroundColor: C.bg },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.primaryFg, fontWeight: '700', fontSize: 13 },
  input: { height: 44, paddingHorizontal: 12, borderRadius: RADIUS.md, backgroundColor: C.muted, borderWidth: 1, borderColor: C.border, color: C.ink, marginTop: 4 },
  jtOpt: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border },
  actBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemCard: { width: '30%', aspectRatio: 1, backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  lockBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.muted, borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2 },
  checkBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: C.primary, borderRadius: 10, padding: 2 },
});
