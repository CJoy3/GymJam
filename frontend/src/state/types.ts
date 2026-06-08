/** Shared view-model types and constants for the GymJam app state. */
import * as badgesApi from '../../lib/api/badges';
import * as notificationsApi from '../../lib/api/notifications';
import * as potApi from '../../lib/api/pot';
import * as roomApi from '../../lib/api/room';

export type DayState = 'planned' | 'checked-in' | 'missed' | 'locked' | 'unselected' | 'rescheduled';
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
  totalElo: number;        // sum of ELO across the group's members (bigger groups aren't penalised)
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
  avatar: string | null;
  elo: number;
  isLeader: boolean;
  thisWeek: DayStatus[];
  nextWeek: DayStatus[];
}

export interface AppStateShape {
  // Loading
  ready: boolean;
  reloading: boolean;

  // Profile
  userId: string | null;
  displayName: string;
  avatar: string | null;
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
  isLeader: boolean;
  groups: Group[];
  joinGroup: (groupId: string) => Promise<boolean>;
  leaveGroup: () => Promise<void>;
  addGroup: (g: {
    name: string;
    weekly_stake_elo: number;
    join_type: 'open' | 'request';
    required_pledges: number;
    stake_per_miss: number;
  }) => Promise<boolean>;

  // Requests
  joinRequests: JoinRequest[];
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;

  // Plans
  thisWeek: DayStatus[];
  nextWeek: DayStatus[];
  todayIndex: number;
  todayDow: number;                         // 0=Mon … 6=Sun (simulated clock)
  thisWeekIsPractice: boolean;              // first week after group creation
  toggleNextWeekDay: (i: number) => Promise<void>;
  setPlannedDays: (days: number[]) => Promise<void>;
  setThisWeekDays: (days: number[]) => Promise<void>;
  lockNextWeek: () => Promise<void>;
  addNextWeekDay: (i: number) => Promise<void>;
  checkInToday: () => Promise<void>;
  rescheduleMissedDay: (dow: number) => Promise<void>;

  // Dev clock — toggle between the real week and one week ahead
  weekSimulated: boolean;        // true when the clock is shifted into next week
  toggleWeek: () => Promise<void>;

  // Dev clock — fine-grained day/week stepping, for walking through pledge
  // state transitions one step at a time while testing.
  goToPreviousWeek: () => Promise<void>;
  goToNextWeek: () => Promise<void>;
  goToPreviousDay: () => Promise<void>;
  goToNextDay: () => Promise<void>;

  // Refresh on demand (used by screens that come back into focus)
  refreshGroupsAtGym: () => Promise<void>;
  // Lighter refresh of just the current group's live data (members/pot/activity),
  // for frequent polling on group screens without refetching the whole list.
  refreshGroup: () => Promise<void>;

  // Pot — full breakdown for the current week + simpler aggregate
  pot: number;                              // total_pot_elo for current week (alias)
  potCurrent: potApi.PotDetail | null;      // current week's conditions + member rows
  potNext: potApi.PotDetail | null;         // next week's pending conditions
  updatePotConditions: (
    week: 'current' | 'next',
    required: number,
    stake: number,
  ) => Promise<void>;

  // Group members (this & next week pledges per person)
  groupMembers: GroupMember[];
  refreshMembers: () => Promise<void>;

  // Group activity feed + nudges
  activity: notificationsApi.ActivityItem[];
  refreshActivity: () => Promise<void>;
  nudge: (targetUserId: string) => Promise<void>;
  nudgeCooldowns: Record<string, number>; // userId → epoch ms until allowed again

  // Badges (derived flags from real stats)
  badges: badgesApi.Badges;
  refreshBadges: () => Promise<void>;

  // Profile
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  setElo: (elo: number) => Promise<void>;

  // Gym-space room
  roomItems: roomApi.RoomItem[];
  placeRoomItem: (itemId: string, slot: number | null) => Promise<void>;

  // Refetch hooks
  refreshAll: () => Promise<void>;
}
