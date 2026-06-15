import { apiDelete, apiGet, apiPost } from './client';
import type { PlanDay } from './plans';

export interface Friend {
  user_id: string;
  display_name: string;
  avatar: string | null;
  tag: string | null;
  elo: number;
  /** True when this friend is also in MY group (their pledges already show there). */
  in_my_group: boolean;
  this_week_days: PlanDay[];
}

export interface FriendRequest {
  id: string;
  user_id: string;
  display_name: string;
  avatar: string | null;
  tag: string | null;
  created_at: string;
}

/** Accepted friends with their current-week pledges (read-only). */
export const listFriends = () => apiGet<Friend[]>('/friends');

/** Pending requests addressed to me. */
export const listFriendRequests = () => apiGet<FriendRequest[]>('/friends/requests');

/** Send a friend request by #tag. Auto-accepts if they already requested me. */
export const sendFriendRequest = (tag: string) =>
  apiPost<{ action: 'requested' | 'accepted' }>('/friends/request', { tag });

/** Send a friend request straight to a user id (e.g. a group member-no tag
 *  needed, so tags stay private). Auto-accepts if they already requested me. */
export const sendFriendRequestToUser = (userId: string) =>
  apiPost<{ action: 'requested' | 'accepted' }>(`/friends/request-user/${userId}`);

export const acceptFriendRequest = (request_id: string) =>
  apiPost<{ id: string; status: string }>(`/friends/requests/${request_id}/accept`);

export const declineFriendRequest = (request_id: string) =>
  apiPost<{ id: string; status: string }>(`/friends/requests/${request_id}/decline`);

export const removeFriend = (friend_user_id: string) =>
  apiDelete<{ ok: boolean }>(`/friends/${friend_user_id}`);
