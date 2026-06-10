import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode,
} from 'react';
import { AppState as RNAppState } from 'react-native';
import * as Location from 'expo-location';

import * as badgesApi from '../../lib/api/badges';
import * as devApi from '../../lib/api/dev';
import * as gymsApi from '../../lib/api/gyms';
import * as groupsApi from '../../lib/api/groups';
import * as notificationsApi from '../../lib/api/notifications';
import * as plansApi from '../../lib/api/plans';
import * as potApi from '../../lib/api/pot';
import * as roomApi from '../../lib/api/room';
import * as usersApi from '../../lib/api/users';
import { ApiError } from '../../lib/api/client';
import { getStoredLocation, requestAndStoreLocation, type Coords } from '../../lib/location';
import { readCache, writeCache } from '../../lib/cache';
import { showToast } from '../ui/toast';
import {
  AppStateShape, DAYS, DayStatus, Group, GroupMember, Gym, JoinRequest,
} from './types';
import {
  daysToWeek, initialsOf, lockPlannedDays, planToWeek, recalcPotDetail, reportError,
  setSelectedDays, setSelectedFutureDays, summaryToGroup, tierForElo, todayIndexForWeek,
  toggleWeekDay,
} from './mappers';

// Re-exported so existing consumers can keep importing these from '../state/AppState'.
export { DAYS } from './types';
export type {
  AppStateShape, DayState, DayStatus, Group, GroupMember, Gym, JoinRequest,
} from './types';

const Ctx = createContext<AppStateShape | null>(null);

/** Slices persisted to local storage for instant (stale-while-revalidate) launches. */
interface CachedSnapshot {
  me?: usersApi.User | null;
  mine?: Group | null;
  groups?: Group[];
  thisWeek?: DayStatus[];
  nextWeek?: DayStatus[];
  thisWeekIsPractice?: boolean;
  todayDow?: number;
  pot?: number;
  potCurrent?: potApi.PotDetail | null;
  potNext?: potApi.PotDetail | null;
  members?: GroupMember[];
  activity?: notificationsApi.ActivityItem[];
  badges?: badgesApi.Badges;
  roomItems?: roomApi.RoomItem[];
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [me, setMe] = useState<usersApi.User | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  // PRIVATE device location (on-device only; never sent to the backend).
  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [groupsAtGym, setGroupsAtGym] = useState<Group[]>([]);
  const [myGroupSummary, setMyGroupSummary] = useState<Group | null>(null);
  const [thisWeek, setThisWeek] = useState<DayStatus[]>(DAYS.map((d) => ({ day: d, state: 'unselected' })));
  const [nextWeek, setNextWeek] = useState<DayStatus[]>(DAYS.map((d) => ({ day: d, state: 'unselected' })));
  const [todayDow, setTodayDow] = useState<number>(() => {
    const js = new Date().getDay();
    return js === 0 ? 6 : js - 1;
  });
  const [thisWeekIsPractice, setThisWeekIsPractice] = useState(false);
  const [weekOffsetDays, setWeekOffsetDays] = useState(0);
  const [pot, setPot] = useState(0);
  const [potCurrent, setPotCurrent] = useState<potApi.PotDetail | null>(null);
  const [potNext, setPotNext] = useState<potApi.PotDetail | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [activity, setActivity] = useState<notificationsApi.ActivityItem[]>([]);
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Record<string, number>>({});
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
    setGyms(list.map((g) => ({ id: g.id, name: g.name, latitude: g.latitude ?? null, longitude: g.longitude ?? null })));
  }, []);

  // Groups are global (decoupled from gyms): always load every group on the
  // platform, regardless of the user's home gym. (Args kept for call-site
  // compatibility but no longer used for filtering.)
  const loadGroupsForGym = useCallback(async (gymId?: string | null, _currentUserId?: string | null) => {
    const list = await groupsApi.listGroups(gymId);
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
    setTodayDow(view.today_dow);
    setThisWeekIsPractice(!!view.this_week.is_practice);
  }, []);

  const loadPot = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setPot(0);
      setPotCurrent(null);
      setPotNext(null);
      return;
    }
    try {
      const [cur, nxt] = await Promise.all([
        potApi.getPotDetail(groupId, 'current'),
        potApi.getPotDetail(groupId, 'next'),
      ]);
      setPotCurrent(cur);
      setPotNext(nxt);
      setPot(cur.total_pot_elo);
    } catch {
      setPotCurrent(null);
      setPotNext(null);
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
        avatar: m.avatar,
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

  const loadActivity = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setActivity([]);
      return;
    }
    try {
      setActivity(await notificationsApi.getGroupActivity(groupId));
    } catch {
      setActivity([]);
    }
  }, []);

  const refreshGroupContext = useCallback(
    async (groupId: string | null, isLeader: boolean | undefined) => {
      await Promise.all([
        loadPot(groupId),
        loadInbox(groupId, isLeader),
        loadMembers(groupId),
        loadActivity(groupId),
      ]);
    },
    [loadPot, loadInbox, loadMembers, loadActivity],
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

  const loadClock = useCallback(async (reset = false) => {
    try {
      const clock = reset ? await devApi.resetClock() : await devApi.getClock();
      setWeekOffsetDays(clock.offset_days);
      setTodayDow(clock.today_dow);
    } catch {
      // dev clock is optional; ignore if unavailable
    }
  }, []);

  const bootstrap = useCallback(async (resetClockOnStartup = false) => {
    setReloading(true);
    try {
      const user = await usersApi.registerViaAuth();
      setMe(user);
      await loadClock(resetClockOnStartup);
      // Fire every independent fetch in parallel instead of one-by-one — this
      // is the single biggest startup latency win against the serverless API.
      const groupsPromise = loadGroupsForGym(user.gym_id, user.id);
      const [mine] = await Promise.all([
        groupsPromise,
        loadGyms(),
        loadPlans(),
        loadBadges(),
        loadRoom(),
      ]);
      // Only this depends on the resolved group id, so it runs after the batch.
      await refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      // Loading the pot can settle a finished week as a side effect (paying
      // shares straight onto personal ELO) — re-sync `me` so a freshly-credited
      // payout shows up immediately rather than waiting for the next refresh.
      if (mine?.id) {
        try { setMe(await usersApi.getMe()); } catch { /* keep the registered snapshot */ }
      }
    } catch (e) {
      reportError('Failed to start GymJam', e);
    } finally {
      setReady(true);
      setReloading(false);
    }
  }, [loadGyms, loadGroupsForGym, loadPlans, loadClock, refreshGroupContext, loadBadges, loadRoom]);

  useEffect(() => {
    bootstrap(true);
  }, [bootstrap]);

  /* ----- instant launch: stale-while-revalidate cache -----
   * Paint the last-known state immediately from local storage so the app feels
   * instant on warm launches, then let `bootstrap` refresh from the network in
   * the background. Functional setters (`prev ?? …`) make sure a fast cache read
   * never clobbers fresher data the network may have already returned. */
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await readCache<CachedSnapshot>('snapshot');
      if (!cancelled && snap) {
        setMe((prev) => prev ?? snap.me ?? null);
        setMyGroupSummary((prev) => prev ?? snap.mine ?? null);
        if (snap.groups?.length) setGroupsAtGym((prev) => (prev.length ? prev : snap.groups!));
        if (snap.thisWeek) setThisWeek((prev) => (prev.some((d) => d.state !== 'unselected') ? prev : snap.thisWeek!));
        if (snap.nextWeek) setNextWeek((prev) => (prev.some((d) => d.state !== 'unselected') ? prev : snap.nextWeek!));
        if (typeof snap.thisWeekIsPractice === 'boolean') setThisWeekIsPractice(snap.thisWeekIsPractice);
        if (typeof snap.todayDow === 'number') setTodayDow((prev) => prev || snap.todayDow!);
        if (typeof snap.pot === 'number') setPot((prev) => prev || snap.pot!);
        setPotCurrent((prev) => prev ?? snap.potCurrent ?? null);
        setPotNext((prev) => prev ?? snap.potNext ?? null);
        if (snap.members?.length) setGroupMembers((prev) => (prev.length ? prev : snap.members!));
        if (snap.activity?.length) setActivity((prev) => (prev.length ? prev : snap.activity!));
        if (snap.badges) setBadges((prev) => prev ?? snap.badges!);
        if (snap.roomItems?.length) setRoomItems((prev) => (prev.length ? prev : snap.roomItems!));
        setReady(true); // show cached UI now; the network refresh continues underneath
      }
      hydratedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist a snapshot whenever the key slices change (after first hydration,
  // so we never overwrite the cache with the initial empty state).
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeCache('snapshot', {
      me, mine: myGroupSummary, groups: groupsAtGym, thisWeek, nextWeek, thisWeekIsPractice,
      todayDow, pot, potCurrent, potNext, members: groupMembers, activity, badges, roomItems,
    } satisfies CachedSnapshot);
  }, [
    me, myGroupSummary, groupsAtGym, thisWeek, nextWeek, thisWeekIsPractice,
    todayDow, pot, potCurrent, potNext, groupMembers, activity, badges, roomItems,
  ]);

  /* ----- actions ----- */

  const setGym = useCallback(async (gymId: string) => {
    // Optimistic: set the home gym locally so the UI advances instantly, then
    // persist + refresh in the background.
    setMe((prev) => (prev ? { ...prev, gym_id: gymId } : prev));
    void (async () => {
      try {
        const u = await usersApi.updateMe({ gym_id: gymId });
        setMe(u);
        const mine = await loadGroupsForGym(gymId, u.id);
        void refreshGroupContext(mine?.id ?? null, mine?.isLeader);
      } catch (e) {
        reportError('Could not set gym', e);
      }
    })();
  }, [loadGroupsForGym, refreshGroupContext]);

  const joinGroup = useCallback(async (groupId: string) => {
    if (!me) return false;
    const snapshot = groupsAtGym;
    const prevMine = myGroupSummary;
    const target = snapshot.find((g) => g.id === groupId);
    if (!target) return false;
    const isOpen = target.joinType === 'open';

    // Optimistic local mutation — UI updates before the network call returns.
    const optimistic = snapshot.map((g) => {
      if (g.id !== groupId) return g;
      return isOpen
        ? { ...g, isMember: true, members: g.members + 1 }
        : { ...g, requested: true };
    });
    setGroupsAtGym(optimistic);
    if (isOpen) setMyGroupSummary({ ...target, isMember: true, members: target.members + 1 });

    // Reconcile with the server in the background so the caller (and any
    // navigation) proceeds instantly on the optimistic result.
    void (async () => {
      try {
        const res = await groupsApi.joinGroup(groupId);
        showToast(res.action === 'joined' ? `Joined ${target.name}` : 'Request sent', 'success');
        const mine = await loadGroupsForGym(me.gym_id, me.id);
        void refreshGroupContext(mine?.id ?? null, mine?.isLeader);
        void loadPlans();
      } catch (e) {
        setGroupsAtGym(snapshot);
        setMyGroupSummary(prevMine);
        reportError('Could not join group', e);
      }
    })();
    return true;
  }, [groupsAtGym, loadGroupsForGym, loadPlans, refreshGroupContext, me, myGroupSummary]);

  const leaveGroup = useCallback(async () => {
    if (!myGroupSummary || !me) return;
    const snapshotGroups = groupsAtGym;
    const snapshotMine = myGroupSummary;
    const willDelete = myGroupSummary.isLeader === true && myGroupSummary.members <= 1;

    // Optimistic: drop my membership immediately so the UI feels instant.
    if (willDelete) {
      setGroupsAtGym(snapshotGroups.filter((g) => g.id !== snapshotMine.id));
    } else {
      setGroupsAtGym(
        snapshotGroups.map((g) =>
          g.id === snapshotMine.id ? { ...g, isMember: false, isLeader: false, members: Math.max(0, g.members - 1) } : g,
        ),
      );
    }
    setMyGroupSummary(null);
    setGroupMembers([]);

    void (async () => {
      try {
        const res = await groupsApi.leaveGroup(snapshotMine.id);
        showToast(res.deleted ? `Deleted ${snapshotMine.name}` : `Left ${snapshotMine.name}`, 'success');
        const mine = await loadGroupsForGym(me.gym_id, me.id);
        void refreshGroupContext(mine?.id ?? null, mine?.isLeader);
        void loadPlans();
      } catch (e) {
        setGroupsAtGym(snapshotGroups);
        setMyGroupSummary(snapshotMine);
        reportError('Could not leave group', e);
      }
    })();
  }, [groupsAtGym, loadGroupsForGym, loadPlans, refreshGroupContext, me, myGroupSummary]);

  const refreshGroupsAtGym = useCallback(async () => {
    if (!me) return;
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
    stake_type?: 'elo' | 'money';
    required_pledges: number;
    stake_per_miss: number;
  }) => {
    if (!me) return false;  // groups are global — no home gym required to create one
    try {
      const created = await groupsApi.createGroup({
        gym_id: me.gym_id,
        name: g.name,
        weekly_stake_elo: g.weekly_stake_elo,
        join_type: g.join_type,
        stake_type: g.stake_type ?? 'elo',
        required_pledges: g.required_pledges,
        stake_per_miss: g.stake_per_miss,
      });

      const mine: Group = {
        id: created.id,
        name: created.name,
        members: 1,
        tier: 'Regular',
        totalElo: me.elo,
        joinType: created.join_type,
        stakeType: created.stake_type ?? 'elo',
        isLeader: true,
        isMember: true,
        requested: false,
      };
      setMyGroupSummary(mine);
      setGroupsAtGym((prev) => [mine, ...prev.filter((group) => group.id !== mine.id)]);
      setGroupMembers([]);
      setPot(0);
      setPotCurrent(null);
      setPotNext(null);

      void (async () => {
        const refreshedMine = await loadGroupsForGym(me.gym_id, me.id);
        await Promise.all([
          refreshGroupContext(refreshedMine?.id ?? mine.id, refreshedMine?.isLeader ?? true),
          loadPlans(),
        ]);
      })().catch(() => {
        // The group already exists; keep the optimistic state and let pull-to-refresh reconcile.
      });
      return true;
    } catch (e) {
      reportError('Could not create group', e);
      return false;
    }
  }, [loadGroupsForGym, loadPlans, refreshGroupContext, me]);

  const approveRequest = useCallback(async (id: string) => {
    const snapshot = joinRequests;
    const target = snapshot.find((r) => r.id === id);
    setJoinRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await groupsApi.approveRequest(id);
      if (target) showToast(`Approved ${target.userName}`, 'success');
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      setJoinRequests(snapshot);
      reportError('Could not approve request', e);
    }
  }, [joinRequests, refreshGroupContext, myGroupSummary]);

  const rejectRequest = useCallback(async (id: string) => {
    const snapshot = joinRequests;
    setJoinRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await groupsApi.rejectRequest(id);
      showToast('Request declined', 'info');
      if (myGroupSummary?.id) {
        await loadInbox(myGroupSummary.id, myGroupSummary.isLeader);
      }
    } catch (e) {
      setJoinRequests(snapshot);
      reportError('Could not reject request', e);
    }
  }, [joinRequests, loadInbox, myGroupSummary]);

  const toggleNextWeekDay = useCallback(async (i: number) => {
    const snapshotNextWeek = nextWeek;
    const optimisticNextWeek = toggleWeekDay(nextWeek, i);
    setNextWeek(optimisticNextWeek);
    try {
      const plan = await plansApi.toggleNextDay(i);
      setNextWeek(planToWeek(plan));
      // Refresh pot/members in the background — don't block the interaction.
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      setNextWeek(snapshotNextWeek);
      reportError('Could not update plan', e);
    }
  }, [myGroupSummary, nextWeek, refreshGroupContext]);

  const setPlannedDays = useCallback(async (days: number[]) => {
    const snapshotNextWeek = nextWeek;
    const optimisticNextWeek = setSelectedDays(nextWeek, days);
    setNextWeek(optimisticNextWeek);
    try {
      const plan = await plansApi.setPlannedDays(days);
      setNextWeek(planToWeek(plan));
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      setNextWeek(snapshotNextWeek);
      reportError('Could not save plan', e);
    }
  }, [myGroupSummary, nextWeek, refreshGroupContext]);

  const setThisWeekDays = useCallback(async (days: number[]) => {
    const snapshotThisWeek = thisWeek;
    const optimisticThisWeek = setSelectedFutureDays(thisWeek, days, todayDow);
    setThisWeek(optimisticThisWeek);
    try {
      const plan = await plansApi.setCurrentWeekDays(days);
      setThisWeek(planToWeek(plan));
      setThisWeekIsPractice(!!plan.is_practice);
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      setThisWeek(snapshotThisWeek);
      reportError('Could not save pledges', e);
    }
  }, [myGroupSummary, thisWeek, todayDow, refreshGroupContext]);

  const addNextWeekDay = useCallback(async (i: number) => {
    // "Join another member's day" is just an additive toggle on our plan.
    const day = nextWeek[i];
    if (day.state !== 'unselected') return;
    await toggleNextWeekDay(i);
  }, [nextWeek, toggleNextWeekDay]);

  const lockNextWeek = useCallback(async () => {
    const snapshotNextWeek = nextWeek;
    const optimisticNextWeek = lockPlannedDays(nextWeek);
    setNextWeek(optimisticNextWeek);
    try {
      const plan = await plansApi.lockNextWeek();
      setNextWeek(planToWeek(plan));
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      setNextWeek(snapshotNextWeek);
      reportError('Could not lock the week', e);
    }
  }, [myGroupSummary, nextWeek, refreshGroupContext]);

  const checkInToday = useCallback(async () => {
    const snapshotWeek = thisWeek;
    const snapshotMe = me;
    // Optimistic: flip *today's* (simulated-clock) planned/locked day to
    // checked-in and bump ELO. Use the server-provided todayDow, not the real
    // weekday, so it stays correct when the dev clock is shifted.
    const todayState = thisWeek[todayDow]?.state;
    if (todayState === 'planned' || todayState === 'locked') {
      setThisWeek((week) => week.map((d, i) => (i === todayDow ? { ...d, state: 'checked-in' } : d)));
      setMe((prev) => (prev ? { ...prev, elo: prev.elo + 10 } : prev));
    }

    try {
      const res = await plansApi.checkInToday();
      setThisWeek(planToWeek(res.plan));
      setMe((prev) => (prev ? { ...prev, elo: res.new_elo } : prev));
      showToast('Session counted · +10 ELO', 'success');
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
      void loadBadges();
    } catch (e) {
      setThisWeek(snapshotWeek);
      setMe(snapshotMe);
      reportError('Could not check in', e);
    }
  }, [thisWeek, todayDow, me, refreshGroupContext, myGroupSummary, loadBadges]);

  const rescheduleMissedDay = useCallback(async (dow: number) => {
    try {
      const res = await plansApi.rescheduleMissedDay(dow);
      setThisWeek(planToWeek(res.this_week));
      setNextWeek(planToWeek(res.next_week));
      setMe((prev) => (prev ? { ...prev, elo: res.new_elo } : prev));
      if (res.outcome === 'moved') {
        const target = res.moved_to_dow != null ? DAYS[res.moved_to_dow] : 'next week';
        showToast(`Session moved to ${target} — no penalty`, 'success');
      } else {
        showToast(
          res.penalty_elo > 0
            ? `Next week is full — 50% penalty applied (−${res.penalty_elo} ELO)`
            : 'Next week is full — session excused',
          'info',
        );
      }
      void refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader);
    } catch (e) {
      reportError('Could not reschedule', e);
    }
  }, [myGroupSummary, refreshGroupContext]);

  const updateTag = useCallback(async (tag: string) => {
    const snapshotMe = me;
    try {
      const u = await usersApi.updateTag(tag);
      setMe(u);
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not update tag', e);
      throw e;
    }
  }, [me]);

  const updateDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshotMe = me;
    setMe((prev) => (prev ? { ...prev, display_name: trimmed } : prev));
    try {
      const u = await usersApi.updateMe({ display_name: trimmed });
      setMe(u);
      // Member list shows display_name, so refresh it.
      if (myGroupSummary?.id) void loadMembers(myGroupSummary.id);
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not update name', e);
    }
  }, [loadMembers, me, myGroupSummary]);

  const updateAvatar = useCallback(async (avatar: string) => {
    const snapshotMe = me;
    setMe((prev) => (prev ? { ...prev, avatar } : prev));
    try {
      const u = await usersApi.updateMe({ avatar });
      setMe(u);
      // The group list shows my avatar, so refresh it.
      if (myGroupSummary?.id) void loadMembers(myGroupSummary.id);
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not update avatar', e);
    }
  }, [loadMembers, me, myGroupSummary]);

  // Load any previously-granted PRIVATE location once on mount (device-local;
  // separate from the public squad-map sharing below).
  useEffect(() => {
    getStoredLocation().then((c) => { if (c) setMyLocation(c); });
  }, []);

  // Ask permission + re-read GPS, storing it locally only. Returns the fix (or
  // null if denied). Does NOT push to the backend — stays private.
  const refreshMyLocation = useCallback(async () => {
    const c = await requestAndStoreLocation();
    if (c) setMyLocation(c);
    return c;
  }, []);

  // Push the current GPS fix to the backend (only meaningful while sharing).
  const pushLocation = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMe(await usersApi.updateMe({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
    } catch {
      // best-effort; keep prior location
    }
  }, []);

  const setShareLocation = useCallback(async (on: boolean) => {
    const snapshotMe = me;
    setMe((prev) => (prev ? { ...prev, share_location: on } : prev)); // optimistic
    try {
      if (on) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setMe(snapshotMe);
          showToast('Location permission is needed to share your spot', 'error');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMe(await usersApi.updateMe({ share_location: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        showToast('Sharing your location with your squad', 'success');
      } else {
        setMe(await usersApi.updateMe({ share_location: false }));
        showToast('Location sharing turned off', 'info');
      }
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not update location sharing', e);
    }
  }, [me]);

  // While sharing, refresh my location on a gentle cadence + whenever the app
  // returns to the foreground — never while backgrounded.
  const sharing = me?.share_location ?? false;
  useEffect(() => {
    if (!sharing) return;
    pushLocation();
    const id = setInterval(() => { if (RNAppState.currentState === 'active') pushLocation(); }, 60000);
    const sub = RNAppState.addEventListener('change', (s) => { if (s === 'active') pushLocation(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [sharing, pushLocation]);

  const setElo = useCallback(async (elo: number) => {
    const snapshotMe = me;
    setMe((prev) => (prev ? { ...prev, elo } : prev));
    try {
      const u = await usersApi.updateMe({ elo });
      setMe(u);
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not set ELO', e);
    }
  }, [me]);

  const setMoney = useCallback(async (pence: number) => {
    const snapshotMe = me;
    setMe((prev) => (prev ? { ...prev, money: pence } : prev));
    try {
      const u = await usersApi.updateMe({ money: pence });
      setMe(u);
    } catch (e) {
      setMe(snapshotMe);
      reportError('Could not set wallet balance', e);
    }
  }, [me]);

  const nudge = useCallback(async (targetUserId: string) => {
    if (!myGroupSummary?.id) return;
    // Optimistically start the hour-long cooldown so the button locks instantly.
    const oneHour = 60 * 60 * 1000;
    setNudgeCooldowns((prev) => ({ ...prev, [targetUserId]: Date.now() + oneHour }));
    try {
      const res = await notificationsApi.nudgeMember(myGroupSummary.id, targetUserId);
      setNudgeCooldowns((prev) => ({ ...prev, [targetUserId]: new Date(res.next_allowed_at).getTime() }));
      showToast('Nudge sent 👟', 'success');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        // Already nudged recently — keep the cooldown and surface the message.
        showToast(e.message, 'info');
      } else {
        setNudgeCooldowns((prev) => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
        reportError('Could not nudge', e);
      }
    }
  }, [myGroupSummary]);

  const updatePotConditions = useCallback(
    async (week: 'current' | 'next', required: number, stake: number) => {
      if (!myGroupSummary?.id) return;
      const snapshotCurrent = potCurrent;
      const snapshotNext = potNext;
      if (week === 'current') {
        const optimisticCurrent = recalcPotDetail(potCurrent, required, stake);
        setPotCurrent(optimisticCurrent);
        setPot(optimisticCurrent?.total_pot_elo ?? 0);
      } else {
        setPotNext(recalcPotDetail(potNext, required, stake));
      }
      try {
        const detail = await potApi.updatePotConditions(myGroupSummary.id, week, required, stake);
        if (week === 'current') {
          setPotCurrent(detail);
          setPot(detail.total_pot_elo);
        } else {
          setPotNext(detail);
        }
        showToast('Pot conditions updated', 'success');
        void refreshGroupContext(myGroupSummary.id, myGroupSummary.isLeader).catch(() => { });
      } catch (e) {
        setPotCurrent(snapshotCurrent);
        setPotNext(snapshotNext);
        if (week === 'current') setPot(snapshotCurrent?.total_pot_elo ?? 0);
        reportError('Could not update pot', e);
      }
    },
    [myGroupSummary, potCurrent, potNext, refreshGroupContext],
  );

  const toggleWeek = useCallback(async () => {
    // Two-state dev toggle: real week (offset 0) ⇄ one week ahead. Re-bootstraps
    // from the server (the source of truth after a clock change) so plans, pot,
    // and the rotating rule setter all reflect the new week end-to-end.
    const goingForward = weekOffsetDays === 0;
    try {
      // Two-state toggle: forward = +1 week; backward = snap all the way back to
      // the real week (offset 0) in a single press, even if earlier testing left
      // the clock several weeks ahead.
      const clock = goingForward ? await devApi.advanceWeek() : await devApi.resetClock();
      if (clock.persisted === false) {
        showToast('Dev clock not saved — run schema.sql (dev_clock table missing)', 'error');
        return;
      }
      setWeekOffsetDays(clock.offset_days);
      setTodayDow(clock.today_dow);
      await bootstrap(false);
      showToast(goingForward ? 'Jumped to next week' : 'Back to this week', 'success');
    } catch (e) {
      reportError('Could not change week', e);
    }
  }, [bootstrap, weekOffsetDays]);

  // Fine-grained dev clock controls — step the simulated "today" forward or
  // backward by a single day or week, so testers can walk through pledge state
  // transitions (planned → locked → checked-in/missed, week rollovers, …) one
  // step at a time rather than only jumping a whole week.
  const stepClock = useCallback(async (action: () => Promise<devApi.DevClock>, message: string) => {
    try {
      const clock = await action();
      if (clock.persisted === false) {
        showToast('Dev clock not saved — run schema.sql (dev_clock table missing)', 'error');
        return;
      }
      setWeekOffsetDays(clock.offset_days);
      setTodayDow(clock.today_dow);
      await bootstrap(false);
      showToast(message, 'success');
    } catch (e) {
      reportError('Could not change the simulated date', e);
    }
  }, [bootstrap]);

  const goToPreviousWeek = useCallback(
    () => stepClock(devApi.previousWeek, 'Back a week'),
    [stepClock],
  );
  const goToNextWeek = useCallback(
    () => stepClock(devApi.advanceWeek, 'Jumped to next week'),
    [stepClock],
  );
  const goToPreviousDay = useCallback(
    () => stepClock(devApi.previousDay, 'Back a day'),
    [stepClock],
  );
  const goToNextDay = useCallback(
    () => stepClock(devApi.nextDay, 'Jumped to next day'),
    [stepClock],
  );

  const updateStakeType = useCallback(async (stakeType: 'elo' | 'money') => {
    if (!myGroupSummary?.id) return;
    const groupId = myGroupSummary.id;
    // Only NEXT week changes — optimistically reflect it on potNext; leave
    // potCurrent (and the group's current-week display) untouched.
    const snapshotNext = potNext;
    setPotNext((prev) => (prev ? { ...prev, stake_type: stakeType } : prev));
    try {
      await groupsApi.updateStakeType(groupId, stakeType);
      showToast(`Pot type set to ${stakeType === 'money' ? 'money' : 'ELO'} from next week`, 'success');
      // Re-pull pot detail so potCurrent/potNext reflect the server's frozen types.
      void loadPot(groupId);
    } catch (e) {
      setPotNext(snapshotNext);
      reportError('Could not change stake type', e);
    }
  }, [myGroupSummary, potNext, loadPot]);

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

      userId: me?.id ?? null,
      displayName: me?.display_name ?? 'You',
      avatar: me?.avatar ?? null,
      shareLocation: me?.share_location ?? false,
      setShareLocation,
      myLocation,
      refreshMyLocation,
      elo: me?.elo ?? 0,
      streak: me?.streak ?? 0,
      tag: me?.tag ?? null,
      tagChanges: me?.tag_changes ?? 0,
      money: me?.money ?? 0,
      moneyWeekChange: me?.money_week_change ?? 0,

      gyms,
      gymName,
      gymId: me?.gym_id ?? null,
      setGym,

      groupName: myGroupSummary?.name ?? '',
      groupId: myGroupSummary?.id ?? null,
      isLeader: myGroupSummary?.isLeader === true,
      joinType: myGroupSummary?.joinType ?? 'open',
      // Per-week currency: current week is frozen on potCurrent; next week (what
      // the leader's toggle changes) lives on potNext. Fall back to the group's
      // baseline type when the pot detail hasn't loaded yet.
      stakeType: potCurrent?.stake_type ?? myGroupSummary?.stakeType ?? 'elo',
      nextStakeType: potNext?.stake_type ?? myGroupSummary?.stakeType ?? 'elo',
      updateStakeType,
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
      todayDow,
      thisWeekIsPractice,
      toggleNextWeekDay,
      setPlannedDays,
      setThisWeekDays,
      addNextWeekDay,
      lockNextWeek,
      checkInToday,
      rescheduleMissedDay,

      weekSimulated: weekOffsetDays > 0,
      toggleWeek,
      goToPreviousWeek,
      goToNextWeek,
      goToPreviousDay,
      goToNextDay,

      refreshGroupsAtGym,
      refreshGroup: () => refreshGroupContext(myGroupSummary?.id ?? null, myGroupSummary?.isLeader),

      pot,
      potCurrent,
      potNext,
      updatePotConditions,

      groupMembers,
      refreshMembers: () => loadMembers(myGroupSummary?.id ?? null),

      activity,
      refreshActivity: () => loadActivity(myGroupSummary?.id ?? null),
      nudge,
      nudgeCooldowns,

      badges,
      refreshBadges: loadBadges,

      updateTag,
      updateDisplayName,
      updateAvatar,
      setElo,
      setMoney,

      roomItems,
      placeRoomItem,

      refreshAll: () => bootstrap(false),
    };
  }, [
    activity, addGroup, addNextWeekDay, approveRequest, badges, bootstrap, checkInToday,
    goToNextDay, goToNextWeek, goToPreviousDay, goToPreviousWeek,
    groupMembers, groupsAtGym, gyms, joinGroup, joinRequests, leaveGroup, loadActivity, loadBadges, loadMembers,
    lockNextWeek, me, myGroupSummary, nextWeek, nudge, nudgeCooldowns, placeRoomItem, pot, potCurrent, potNext,
    ready, refreshGroupContext, refreshGroupsAtGym, rejectRequest, reloading, rescheduleMissedDay, roomItems, setGym,
    setPlannedDays, setThisWeekDays, thisWeek, thisWeekIsPractice, todayDow, toggleNextWeekDay,
    setElo, setMoney, setShareLocation, myLocation, refreshMyLocation, toggleWeek, updateAvatar, updateDisplayName, updatePotConditions, updateStakeType, updateTag, weekOffsetDays,
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
