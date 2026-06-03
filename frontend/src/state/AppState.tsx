import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode,
} from 'react';
import { Alert } from 'react-native';

import * as badgesApi from '../../lib/api/badges';
import * as gymsApi from '../../lib/api/gyms';
import * as groupsApi from '../../lib/api/groups';
import * as plansApi from '../../lib/api/plans';
import * as roomApi from '../../lib/api/room';
import * as usersApi from '../../lib/api/users';
import { getOrCreateUserId } from '../../lib/userId';

export type DayState = 'planned' | 'checked-in' | 'missed' | 'locked' | 'unselected';
export interface DayStatus { day: string; state: DayState; }

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ---- View models exposed to screens ---- */

export interface Gym {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  members: number;
  tier: string;            // derived: "Beginner" for now (no DB column yet)
  stake: string;           // "500 ELO"
  joinType: 'open' | 'request';
  isLeader?: boolean;
  isMember?: boolean;
  requested?: boolean;
}

export interface JoinRequest {
  id: string;
  userName: string;
  groupName: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  initials: string;
  elo: number;
  isLeader: boolean;
  thisWeek: DayStatus[];
  nextWeek: DayStatus[];
}

interface AppStateShape {
  // Loading
  ready: boolean;
  reloading: boolean;

  // Profile
  displayName: string;
  elo: number;
  streak: number;

  // Gyms
  gyms: Gym[];
  gymName: string;
  gymId: string | null;
  setGym: (gymId: string) => Promise<void>;

  // Groups
  groupName: string;
  groupId: string | null;
  groups: Group[];
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
  addGroup: (g: { name: string; weekly_stake_elo: number; join_type: 'open' | 'request' }) => Promise<void>;

  // Requests
  joinRequests: JoinRequest[];
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;

  // Plans
  thisWeek: DayStatus[];
  nextWeek: DayStatus[];
  todayIndex: number;
  toggleNextWeekDay: (i: number) => Promise<void>;
  setPlannedDays: (days: number[]) => Promise<void>;
  lockNextWeek: () => Promise<void>;
  addNextWeekDay: (i: number) => Promise<void>;
  checkInToday: () => Promise<void>;

  // Refresh on demand (used by screens that come back into focus)
  refreshGroupsAtGym: () => Promise<void>;

  // Pot
  pot: number;

  // Group members (this & next week pledges per person)
  groupMembers: GroupMember[];
  refreshMembers: () => Promise<void>;

  // Badges (derived flags from real stats)
  badges: badgesApi.Badges;
  refreshBadges: () => Promise<void>;

  // Profile
  updateDisplayName: (name: string) => Promise<void>;

  // Gym-space room
  roomItems: roomApi.RoomItem[];
  placeRoomItem: (itemId: string, slot: number | null) => Promise<void>;

  // Refetch hooks
  refreshAll: () => Promise<void>;
}

const Ctx = createContext<AppStateShape | null>(null);

function tierForElo(elo: number): string {
  return elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';
}

function planToWeek(plan: plansApi.WeeklyPlan): DayStatus[] {
  // server returns days sorted by day_of_week 0..6
  return DAYS.map((day, i) => {
    const found = plan.days.find((d) => d.day_of_week === i);
    return { day, state: (found?.state ?? 'unselected') as DayState };
  });
}

function daysToWeek(days: plansApi.PlanDay[]): DayStatus[] {
  return DAYS.map((day, i) => {
    const found = days.find((d) => d.day_of_week === i);
    return { day, state: (found?.state ?? 'unselected') as DayState };
  });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function todayIndexForWeek(week: DayStatus[]): number {
  // matches the original: first 'planned' day in this week
  return week.findIndex((d) => d.state === 'planned');
}

function summaryToGroup(s: groupsApi.GroupSummary): Group {
  return {
    id: s.id,
    name: s.name,
    members: s.member_count,
    tier: 'Regular',
    stake: `${s.weekly_stake_elo} ELO`,
    joinType: s.join_type,
    isLeader: s.is_leader,
    isMember: s.is_member,
    requested: s.join_request_pending,
  };
}

function reportError(action: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : 'Unknown error';
  Alert.alert(action, msg);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [me, setMe] = useState<usersApi.User | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [groupsAtGym, setGroupsAtGym] = useState<Group[]>([]);
  const [myGroupSummary, setMyGroupSummary] = useState<Group | null>(null);
  const [thisWeek, setThisWeek] = useState<DayStatus[]>(DAYS.map((d) => ({ day: d, state: 'unselected' })));
  const [nextWeek, setNextWeek] = useState<DayStatus[]>(DAYS.map((d) => ({ day: d, state: 'unselected' })));
  const [pot, setPot] = useState(0);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [badges, setBadges] = useState<badgesApi.Badges>({
    first_week: false,
    streak_master: false,
    early_bird: false,
    consistency_king: false,
    pot_winner: false,
    group_leader: false,
  });
  const [roomItems, setRoomItems] = useState<roomApi.RoomItem[]>([]);

  /* ----- loaders ----- */

  const loadGyms = useCallback(async () => {
    const list = await gymsApi.listGyms();
    setGyms(list.map((g) => ({ id: g.id, name: g.name })));
  }, []);

  const loadGroupsForGym = useCallback(async (gymId: string, currentUserId: string) => {
    const list = await groupsApi.listGroupsAtGym(gymId);
    const mapped = list.map(summaryToGroup);
    setGroupsAtGym(mapped);
    const mine = mapped.find((g) => g.isMember) ?? null;
    setMyGroupSummary(mine);
    return mine;
  }, []);

  const loadPlans = useCallback(async () => {
    const view = await plansApi.getMyPlans();
    setThisWeek(planToWeek(view.this_week));
    setNextWeek(planToWeek(view.next_week));
  }, []);

  const loadPot = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setPot(0);
      return;
    }
    try {
      const p = await groupsApi.getGroupPot(groupId, 'current');
      setPot(p.total_elo);
    } catch {
      setPot(0);
    }
  }, []);

  const loadMembers = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setGroupMembers([]);
      return;
    }
    try {
      const list = await groupsApi.listGroupMembers(groupId);
      setGroupMembers(list.map((m) => ({
        userId: m.user_id,
        name: m.display_name,
        initials: initialsOf(m.display_name),
        elo: m.elo,
        isLeader: m.role === 'leader',
        thisWeek: daysToWeek(m.this_week_days),
        nextWeek: daysToWeek(m.next_week_days),
      })));
    } catch {
      setGroupMembers([]);
    }
  }, []);

  const loadInbox = useCallback(async (groupId: string | null, isLeader: boolean | undefined) => {
    if (!groupId || !isLeader) {
      setJoinRequests([]);
      return;
    }
    try {
      const reqs = await groupsApi.listJoinRequests(groupId);
      setJoinRequests(reqs.map((r) => ({ id: r.id, userName: r.display_name, groupName: '' })));
    } catch {
      setJoinRequests([]);
    }
  }, []);

  const refreshGroupContext = useCallback(
    async (groupId: string | null, isLeader: boolean | undefined) => {
      await Promise.all([
        loadPot(groupId),
        loadInbox(groupId, isLeader),
        loadMembers(groupId),
      ]);
    },
    [loadPot, loadInbox, loadMembers],
  );

  const loadBadges = useCallback(async () => {
    try {
      setBadges(await badgesApi.getMyBadges());
    } catch {
      // keep prior state
    }
  }, []);

  const loadRoom = useCallback(async () => {
    try {
      setRoomItems(await roomApi.getMyRoom());
    } catch {
      // keep prior state
    }
  }, []);

  /* ----- bootstrap ----- */

  const bootstrap = useCallback(async () => {
    setReloading(true);
    try {
      const deviceId = await getOrCreateUserId();
      const user = await usersApi.registerUser(deviceId);
      setMe(user);
      await loadGyms();
      if (user.gym_id) {
        const mine = await loadGroupsForGym(user.gym_id, user.id);
        await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      } else {
        setGroupsAtGym([]);
        setMyGroupSummary(null);
        setPot(0);
        setJoinRequests([]);
        setGroupMembers([]);
      }
      await loadPlans();
      await Promise.all([loadBadges(), loadRoom()]);
    } catch (e) {
      reportError('Failed to start GymJam', e);
    } finally {
      setReady(true);
      setReloading(false);
    }
  }, [loadGyms, loadGroupsForGym, loadPlans, refreshGroupContext, loadBadges, loadRoom]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* ----- actions ----- */

  const setGym = useCallback(async (gymId: string) => {
    try {
      const u = await usersApi.updateMe({ gym_id: gymId });
      setMe(u);
      const mine = await loadGroupsForGym(gymId, u.id);
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
    } catch (e) {
      reportError('Could not set gym', e);
    }
  }, [loadGroupsForGym, refreshGroupContext]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!me?.gym_id) return;
    try {
      const res = await groupsApi.joinGroup(groupId);
      const mine = await loadGroupsForGym(me.gym_id, me.id);
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      await loadPlans();
      if (res.action === 'requested') {
        Alert.alert('Request sent', 'The group leader will review your request.');
      }
    } catch (e) {
      reportError('Could not join group', e);
    }
  }, [loadGroupsForGym, loadPlans, refreshGroupContext, me]);

  const leaveGroup = useCallback(async () => {
    if (!myGroupSummary || !me?.gym_id) return;
    try {
      const res = await groupsApi.leaveGroup(myGroupSummary.id);
      const mine = await loadGroupsForGym(me.gym_id, me.id);
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      await loadPlans();
      if (res.deleted) {
        Alert.alert('Group deleted', 'You were the last member, so the group was deleted.');
      } else if (res.promoted_user_id) {
        Alert.alert('You left the group', 'A new leader has been assigned.');
      }
    } catch (e) {
      reportError('Could not leave group', e);
    }
  }, [loadGroupsForGym, loadPlans, refreshGroupContext, me, myGroupSummary]);

  const refreshGroupsAtGym = useCallback(async () => {
    if (!me?.gym_id) return;
    try {
      const mine = await loadGroupsForGym(me.gym_id, me.id);
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
    } catch {
      // best-effort refresh
    }
  }, [loadGroupsForGym, refreshGroupContext, me]);

  const addGroup = useCallback(async (g: {
    name: string;
    weekly_stake_elo: number;
    join_type: 'open' | 'request';
  }) => {
    if (!me?.gym_id) return;
    try {
      await groupsApi.createGroup({
        gym_id: me.gym_id,
        name: g.name,
        weekly_stake_elo: g.weekly_stake_elo,
        join_type: g.join_type,
      });
      const mine = await loadGroupsForGym(me.gym_id, me.id);
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      await loadPlans();
    } catch (e) {
      reportError('Could not create group', e);
    }
  }, [loadGroupsForGym, loadPlans, refreshGroupContext, me]);

  const approveRequest = useCallback(async (id: string) => {
    try {
      await groupsApi.approveRequest(id);
      // Approved request → a new member joined; refresh members/pot too.
      await refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      reportError('Could not approve request', e);
    }
  }, [refreshGroupContext, myGroupSummary]);

  const rejectRequest = useCallback(async (id: string) => {
    try {
      await groupsApi.rejectRequest(id);
      if (myGroupSummary?.id) {
        await loadInbox(myGroupSummary.id, myGroupSummary.isLeader);
      }
    } catch (e) {
      reportError('Could not reject request', e);
    }
  }, [loadInbox, myGroupSummary]);

  const toggleNextWeekDay = useCallback(async (i: number) => {
    try {
      const plan = await plansApi.toggleNextDay(i);
      setNextWeek(planToWeek(plan));
      await refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      reportError('Could not update plan', e);
    }
  }, [refreshGroupContext, myGroupSummary]);

  const setPlannedDays = useCallback(async (days: number[]) => {
    try {
      const plan = await plansApi.setPlannedDays(days);
      setNextWeek(planToWeek(plan));
      await refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      reportError('Could not save plan', e);
    }
  }, [refreshGroupContext, myGroupSummary]);

  const addNextWeekDay = useCallback(async (i: number) => {
    // "Join another member's day" is just an additive toggle on our plan.
    const day = nextWeek[i];
    if (day.state !== 'unselected') return;
    await toggleNextWeekDay(i);
  }, [nextWeek, toggleNextWeekDay]);

  const lockNextWeek = useCallback(async () => {
    try {
      const plan = await plansApi.lockNextWeek();
      setNextWeek(planToWeek(plan));
      await refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      reportError('Could not lock the week', e);
    }
  }, [refreshGroupContext, myGroupSummary]);

  const checkInToday = useCallback(async () => {
    try {
      const res = await plansApi.checkInToday();
      setThisWeek(planToWeek(res.plan));
      setMe((prev) => (prev ? { ...prev, elo: res.new_elo } : prev));
      await Promise.all([
        refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader),
        loadBadges(),
      ]);
    } catch (e) {
      reportError('Could not check in', e);
    }
  }, [refreshGroupContext, myGroupSummary, loadBadges]);

  const updateDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const u = await usersApi.updateMe({ display_name: trimmed });
      setMe(u);
      // Member list shows display_name, so refresh it.
      if (myGroupSummary?.id) await loadMembers(myGroupSummary.id);
    } catch (e) {
      reportError('Could not update name', e);
    }
  }, [loadMembers, myGroupSummary]);

  const placeRoomItem = useCallback(async (itemId: string, slot: number | null) => {
    try {
      const items = await roomApi.setItemPlacement(itemId, slot);
      setRoomItems(items);
    } catch (e) {
      reportError('Could not update gym space', e);
    }
  }, []);

  const value = useMemo<AppStateShape>(() => {
    const gymName = me?.gym_id ? gyms.find((g) => g.id === me.gym_id)?.name ?? '' : '';
    return {
      ready,
      reloading,

      displayName: me?.display_name ?? 'You',
      elo: me?.elo ?? 0,
      streak: me?.streak ?? 0,

      gyms,
      gymName,
      gymId: me?.gym_id ?? null,
      setGym,

      groupName: myGroupSummary?.name ?? '',
      groupId: myGroupSummary?.id ?? null,
      groups: groupsAtGym,
      joinGroup,
      leaveGroup,
      addGroup,

      joinRequests,
      approveRequest,
      rejectRequest,

      thisWeek,
      nextWeek,
      todayIndex: todayIndexForWeek(thisWeek),
      toggleNextWeekDay,
      setPlannedDays,
      addNextWeekDay,
      lockNextWeek,
      checkInToday,

      refreshGroupsAtGym,

      pot,

      groupMembers,
      refreshMembers: () => loadMembers(myGroupSummary?.id ?? null),

      badges,
      refreshBadges: loadBadges,

      updateDisplayName,

      roomItems,
      placeRoomItem,

      refreshAll: bootstrap,
    };
  }, [
    addGroup, addNextWeekDay, approveRequest, badges, bootstrap, checkInToday, groupMembers,
    groupsAtGym, gyms, joinGroup, joinRequests, leaveGroup, loadBadges, loadMembers,
    lockNextWeek, me, myGroupSummary, nextWeek, placeRoomItem, pot, ready, refreshGroupsAtGym,
    rejectRequest, reloading, roomItems, setGym, setPlannedDays, thisWeek, toggleNextWeekDay,
    updateDisplayName,
  ]);

  // tier is purely a function of elo; expose for callers that want it
  void tierForElo;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
