import { apiGet, apiPost } from './client';

export type ActivityKind = 'join_request' | 'nudge' | 'missed' | 'checkin' | 'streak';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  message: string;
  actor_name: string;
  created_at: string | null;
  request_id?: string | null;
  user_id?: string | null;
}

export interface NudgeResult {
  ok: boolean;
  to_user_id: string;
  next_allowed_at: string;
}

export const getGroupActivity = (groupId: string) =>
  apiGet<ActivityItem[]>(`/groups/${groupId}/activity`);

export const nudgeMember = (groupId: string, targetUserId: string) =>
  apiPost<NudgeResult>(`/groups/${groupId}/nudge/${targetUserId}`);
