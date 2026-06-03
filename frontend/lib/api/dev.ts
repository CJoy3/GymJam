import { apiGet, apiPost } from './client';

export interface DevClock {
  offset_days: number;
  offset_weeks: number;
  today: string;
  week_start: string;
  today_dow: number;
}

export const getClock = () => apiGet<DevClock>('/dev/clock');

/** Simulate the next week arriving: shifts the server clock forward 7 days. */
export const advanceWeek = () => apiPost<DevClock>('/dev/advance-week');

export const resetClock = () => apiPost<DevClock>('/dev/reset-clock');
