import { apiGet, apiPatch, apiPost } from './client';

export interface User {
  id: string;
  device_id: string;
  display_name: string;
  elo: number;
  streak: number;
  gym_id: string | null;
  created_at: string;
  updated_at: string;
}

export const registerUser = (device_id: string, display_name?: string) =>
  apiPost<User>('/users/register', { device_id, display_name }, { auth: false });

export const getMe = () => apiGet<User>('/users/me');

export const updateMe = (patch: { display_name?: string; gym_id?: string | null }) =>
  apiPatch<User>('/users/me', patch);
