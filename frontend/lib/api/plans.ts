import { apiGet, apiPost } from './client';

export type DayState = 'unselected' | 'planned' | 'locked' | 'checked-in' | 'missed';

export interface PlanDay {
  day_of_week: number;
  state: DayState;
  checked_in_at: string | null;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  group_id: string | null;
  week_start: string;
  is_locked: boolean;
  stake_elo: number;
  days: PlanDay[];
}

export interface TwoWeekView {
  this_week: WeeklyPlan;
  next_week: WeeklyPlan;
}

export interface CheckInResult {
  plan: WeeklyPlan;
  elo_awarded: number;
  new_elo: number;
}

export const getMyPlans = () => apiGet<TwoWeekView>('/plans/me');

export const toggleNextDay = (dow: number) =>
  apiPost<WeeklyPlan>(`/plans/me/next/days/${dow}/toggle`);

export const setPlannedDays = (planned_days: number[]) =>
  apiPost<WeeklyPlan>('/plans/me/next/set', { planned_days });

export const lockNextWeek = () =>
  apiPost<WeeklyPlan>('/plans/me/next/lock');

export const checkInToday = () => apiPost<CheckInResult>('/checkins/me');
