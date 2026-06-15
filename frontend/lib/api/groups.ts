import { ApiError, apiGet, apiPatch, apiPost } from './client';
import type { PlanDay } from './plans';

export type JoinType = 'open' | 'request';
export type StakeType = 'elo' | 'money';

export interface Group {
  id: string;
  gym_id: string | null;
  name: string;
  weekly_stake_elo: number;
  join_type: JoinType;
  stake_type: StakeType;
  leader_id: string | null;
  created_at: string;
}

export interface GroupSummary extends Group {
  member_count: number;
  total_elo: number;
  is_member: boolean;
  is_leader: boolean;
  join_request_pending: boolean;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Pot {
  group_id: string;
  week_start: string;
  total_elo: number;
  contributor_count: number;
}

/** All groups on the platform-groups are global (not filtered by gym). */
export const listAllGroups = () => apiGet<GroupSummary[]>('/groups');

export const listGroupsAtGym = (gym_id: string) =>
  apiGet<GroupSummary[]>(`/groups/by-gym/${gym_id}`);

export async function listGroups(gym_id?: string | null) {
  try {
    return await listAllGroups();
  } catch (e) {
    if (gym_id && e instanceof ApiError && e.status === 405) {
      return listGroupsAtGym(gym_id);
    }
    throw e;
  }
}

export const createGroup = (payload: {
  gym_id?: string | null;
  name: string;
  weekly_stake_elo: number;
  join_type: JoinType;
  stake_type?: StakeType;
  required_pledges: number;
  stake_per_miss: number;
}) => apiPost<Group>('/groups', payload);

export const joinGroup = (group_id: string) =>
  apiPost<{ action: 'joined' | 'requested' }>(`/groups/${group_id}/join`);

export interface LeaveGroupResult {
  ok: boolean;
  deleted: boolean;
  promoted_user_id: string | null;
}

export const leaveGroup = (group_id: string) =>
  apiPost<LeaveGroupResult>(`/groups/${group_id}/leave`);

export const listJoinRequests = (group_id: string) =>
  apiGet<JoinRequest[]>(`/groups/${group_id}/requests`);

export const approveRequest = (request_id: string) =>
  apiPost<{ id: string; status: string }>(`/groups/requests/${request_id}/approve`);

export const rejectRequest = (request_id: string) =>
  apiPost<{ id: string; status: string }>(`/groups/requests/${request_id}/reject`);

export const getGroupPot = (group_id: string, week: 'current' | 'next' = 'current') =>
  apiGet<Pot>(`/groups/${group_id}/pot?week=${week}`);

export interface GroupMemberDetail {
  user_id: string;
  display_name: string;
  avatar: string | null;
  elo: number;
  role: 'member' | 'leader';
  /** Friend status relative to the viewer: hide 'Add' when 'friends', show
   *  'Sent' when 'requested' (an outgoing pending request). */
  friend_status: 'none' | 'friends' | 'requested';
  joined_at: string;
  this_week_days: PlanDay[];
  next_week_days: PlanDay[];
}

export const listGroupMembers = (group_id: string) =>
  apiGet<GroupMemberDetail[]>(`/groups/${group_id}/members`);

export interface SquadMapMember {
  user_id: string;
  display_name: string;
  avatar: string | null;
  elo: number;
  is_me: boolean;
  gym_id: string | null;
  gym_name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_live?: boolean;
}

/** Group members located at their home gyms-for the Squad Map. */
export const getSquadMap = (group_id: string) =>
  apiGet<SquadMapMember[]>(`/groups/${group_id}/squad-map`);

export const updateStakeType = (group_id: string, stake_type: StakeType) =>
  apiPatch<Group>(`/groups/${group_id}/stake-type`, { stake_type });

export interface CommunityGymMember {
  user_id: string;
  display_name: string;
  avatar: string | null;
  elo: number;
  is_me: boolean;
  items_placed: number;
}

export interface CommunityGymItem {
  item_id: string;
  count: number;
}

export interface CommunityGym {
  group_id: string;
  name: string;
  member_count: number;
  total_elo: number;
  avg_elo: number;
  members: CommunityGymMember[];
  items: CommunityGymItem[];
}

/** The group's members' personalisable gyms joined into one shared space. */
export const getCommunityGym = (group_id: string) =>
  apiGet<CommunityGym>(`/groups/${group_id}/community-gym`);
