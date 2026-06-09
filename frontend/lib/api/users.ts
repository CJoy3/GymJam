import { apiGet, apiPatch, apiPost } from './client';

export interface User {
  id: string;
  device_id: string | null;
  display_name: string;
  avatar: string | null;
  elo: number;
  streak: number;
  gym_id: string | null;
  tag: string | null;
  tag_changes: number;
  // Mocked wallet, in pence. money_week_change is the net delta from the most
  // recent Sunday money-pot payout.
  money: number;
  money_week_change: number;
  created_at: string;
  updated_at: string;
}

/** Register or retrieve the app user linked to the current Supabase auth session. */
export const registerViaAuth = () =>
  apiPost<User>('/users/register');

export const getMe = () => apiGet<User>('/users/me');

export const updateMe = (patch: { display_name?: string; gym_id?: string | null; avatar?: string; elo?: number; money?: number }) =>
  apiPatch<User>('/users/me', patch);

export const updateTag = (tag: string) =>
  apiPost<User>('/users/me/tag', { tag });

export const checkTagAvailable = (tag: string) =>
  apiGet<{ available: boolean; tag: string }>(`/users/check-tag?tag=${encodeURIComponent(tag)}`);
